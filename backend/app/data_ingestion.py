import asyncio
import os
import pandas as pd
import tempfile
import zipfile
import shutil
import aiohttp
import aiofiles

from sqlalchemy import text
from typing import Dict, Any
from concurrent.futures import ThreadPoolExecutor

from .database import get_engine
from .sql_utils import get_sql_query, execute_sql_count
from .logging_utils import YearTypeFilter, setup_logger

year_filter = YearTypeFilter()

logger = setup_logger("data_ingestion", "data_ingestion.log", "INGEST", year_filter)


class DataIngestionService:
    
    def __init__(self):
        self.engine = get_engine()
        self.executor = ThreadPoolExecutor(max_workers=4)

    async def download_data(self, filter_year: str, data_type: str) -> str:
        """Prenese podatke iz API-ja in vrne pot do prenesene datoteke."""
        try:
            # parametri ki jih zahteva api
            filter_param = "DRZAVA"
            filter_value = "1"

            if data_type == "np":
                api_url = "https://ipi.eprostor.gov.si/jgp-service-api/display-views/groups/127/composite-products/322/file"
            else:
                # kpp
                api_url = "https://ipi.eprostor.gov.si/jgp-service-api/display-views/groups/127/composite-products/321/file"
            
            params = {
                "filterParam": filter_param,
                "filterValue": filter_value,
                "filterYear": filter_year
            }
                        
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                "Accept": "*/*"
            }
            
            
            async with aiohttp.ClientSession() as session:

                # Pridobivanje URL-ja za prenos iz API-ja
                async with session.get(api_url, params=params, headers=headers) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        logger.error(f"API zahteva je bila neuspešna, status: {response.status}, odgovor: {error_text}")
                        raise Exception(f"API zahteva je bila neuspešna, status: {response.status}, odgovor: {error_text}")
                    
                    try:
                        json_data = await response.json()
                        
                        if "url" not in json_data:
                            logger.error(f"URL za prenos ni bil najden v odzivu: {json_data}")
                            raise Exception("URL za prenos ni bil najden v odzivu")
                        
                        download_url = json_data["url"]
                        logger.info(f"Najden URL za prenos: {download_url}")
                        
                    except Exception as e:
                        error_text = await response.text()
                        logger.error(f"Odziv ni veljaven JSON: {error_text[:500]}")
                        raise Exception("Odziv ni veljaven JSON")
                

                # Prenos ZIP datoteke
                logger.info("Prenašanje ZIP datoteke...")
                async with session.get(download_url, headers=headers) as file_response:
                    if file_response.status != 200:
                        logger.error(f"Prenos datoteke ni uspel, status: {file_response.status}")
                        raise Exception(f"Prenos datoteke ni uspel, status: {file_response.status}")
                    
                    temp_dir = tempfile.mkdtemp()
                    zip_path = os.path.join(temp_dir, f"{data_type}_downloaded_data.zip")
                    
                    async with aiofiles.open(zip_path, 'wb') as f:
                        async for chunk in file_response.content.iter_chunked(8192):
                            await f.write(chunk)
                    
                    file_size = os.path.getsize(zip_path)
                    logger.info(f"Datoteka prenešena, velikost: {file_size} bajtov")
                    
                    # Preverjanje, ali je ZIP datoteka veljavna
                    try:
                        with zipfile.ZipFile(zip_path, 'r') as zip_test:
                            file_list = zip_test.namelist()
                            logger.info(f"Uspešno potrjeno, da je datoteka ZIP. Vsebuje {len(file_list)} datoteke")
                    except zipfile.BadZipFile:
                        logger.error("Prenesena datoteka ni veljavna ZIP datoteka")
                        raise Exception("Prenesena datoteka ni veljavna ZIP datoteka")
                    
                    logger.info(f"Podatki uspešno preneseni: {zip_path}")
                    return zip_path
                    
        except Exception as e:
            logger.error(f"Napaka pri prenosu podatkov: {str(e)}")
            raise




    def extract_files(self, zip_path: str, data_type: str) -> Dict[str, str]:
        """Razbere datoteke iz ZIP arhiva in vrne poti."""
        try:
            extract_dir = os.path.dirname(zip_path)
            
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)
                
                # Preslikava pričakovanih CSV datotek v tabele
                if data_type == "np":
                    csv_mapping = {
                        'sifranti': None,
                        'np_posel': None,
                        'np_del_stavbe': None
                    }
                    
                    # Iskanje CSV datotek v ekstrahirani vsebini
                    for file in zip_ref.namelist():
                        if file.endswith('.csv'):
                            if 'sifranti' in file.lower():
                                csv_mapping['sifranti'] = os.path.join(extract_dir, file)
                            elif 'posli' in file.lower():
                                csv_mapping['np_posel'] = os.path.join(extract_dir, file)
                            elif 'delistavb' in file.lower():
                                csv_mapping['np_del_stavbe'] = os.path.join(extract_dir, file)
                else:
                    # KPP podatki
                    csv_mapping = {
                        'sifranti': None,
                        'kpp_posel': None,
                        'kpp_del_stavbe': None
                    }
                    
                    # Iskanje CSV datotek v ekstrahirani vsebini
                    for file in zip_ref.namelist():
                        if file.endswith('.csv'):
                            if 'sifranti' in file.lower():
                                csv_mapping['sifranti'] = os.path.join(extract_dir, file)
                            elif 'posli' in file.lower():
                                csv_mapping['kpp_posel'] = os.path.join(extract_dir, file)
                            elif 'delistavb' in file.lower():
                                csv_mapping['kpp_del_stavbe'] = os.path.join(extract_dir, file)
            
            # Preverjanje, ali so vse zahtevane datoteke najdene
            missing_files = [k for k, v in csv_mapping.items() if v is None]
            if missing_files:
                raise Exception(f"Manjkajoče CSV datoteke: {', '.join(missing_files)}")
                
            logger.info(f"Uspešno ekstrahirane datoteke: {csv_mapping}")
            return csv_mapping
            
        except Exception as e:
            logger.error(f"Napaka pri ekstrahiranju datotek: {str(e)}")
            raise
    

    def import_to_staging(self, csv_files: Dict[str, str]):
        """Uvozi CSV podatke v staging tabele."""
        try:
            # Uvoz CSV datotek v ustrezne staging tabele
            for table_name, file_path in csv_files.items():
                if not file_path or not os.path.exists(file_path):
                    logger.warning(f"Datoteka za tabelo {table_name} ne obstaja: {file_path}")
                    continue
                    
                logger.info(f"Uvažanje {file_path} v staging.{table_name}")
                
                # Branje CSV datotek
                try:
                    df = pd.read_csv(file_path, encoding='utf-8', low_memory=False)

                    # Preimenovanje stolpcev v male črke
                    df.columns = [col.lower() for col in df.columns]
                    
                    # Počistimo obstoječe podatke v staging tabeli
                    with self.engine.connect() as conn:
                        truncate_sql = f"TRUNCATE TABLE staging.{table_name};"
                        conn.execute(text(truncate_sql))
                        conn.commit()
                    
                    # Nalaganje podatkov v staging tabelo
                    df.to_sql(
                        name=table_name,
                        schema="staging",
                        con=self.engine,
                        if_exists="append",
                        index=False,
                        chunksize=1000,
                        method='multi'
                    )
                    
                    row_count = execute_sql_count(self.engine, 'staging', table_name)
                    logger.info(f"Uspešno naloženih {row_count} vrstic v staging.{table_name}")
                    
                except Exception as e:
                    logger.error(f"Napaka pri uvozu datoteke {file_path}: {str(e)}")
                    raise
                    
        except Exception as e:
            logger.error(f"Napaka pri uvozu v staging: {str(e)}")
            raise



    def transform_to_core(self, filter_year: str, data_type: str):
        """Pretvori podatke iz staging v core tabele."""
        try:
            # Preverjanje, ali so staging tabele napolnjene
            if data_type == "np":
                staging_del_stavbe_count = execute_sql_count(self.engine, 'staging', 'np_del_stavbe')
                staging_posel_count = execute_sql_count(self.engine, 'staging', 'np_posel')
                table_prefix = "np"
            else:
                staging_del_stavbe_count = execute_sql_count(self.engine, 'staging', 'kpp_del_stavbe')
                staging_posel_count = execute_sql_count(self.engine, 'staging', 'kpp_posel')
                table_prefix = "kpp"
            
            logger.info(f"Podatki v staging: {table_prefix}_del_stavbe={staging_del_stavbe_count}, {table_prefix}_posel={staging_posel_count}")
            
            if staging_del_stavbe_count == 0 or staging_posel_count == 0:
                logger.warning("Staging tabele so prazne! Ne morem nadaljevati s transformacijo.")
                return
                        
            # Preveri ali so vsi id_posla v staging.del_stavbe povezani s posel tabelo
            with self.engine.connect() as conn:
                missing_in_staging = conn.execute(text(f"""
                    SELECT COUNT(*) as count
                    FROM staging.{table_prefix}_del_stavbe d
                    LEFT JOIN staging.{table_prefix}_posel p ON d.id_posla = p.id_posla  
                    WHERE p.id_posla IS NULL AND d.id_posla IS NOT NULL
                """)).scalar()
                
                logger.info(f"vrstice v staging_{table_prefix}_del_stavbe z posel referencami ki niso v posel tabeli: {missing_in_staging}")
                
                if missing_in_staging > 0:
                    examples = conn.execute(text(f"""
                        SELECT d.id_posla, COUNT(*) as count
                        FROM staging.{table_prefix}_del_stavbe d
                        LEFT JOIN staging.{table_prefix}_posel p ON d.id_posla = p.id_posla  
                        WHERE p.id_posla IS NULL AND d.id_posla IS NOT NULL
                        GROUP BY d.id_posla
                        ORDER BY count DESC
                        LIMIT 5
                    """)).fetchall()
                    
                    logger.warning(f"Primeri manjkajočih posel_ids: {[(row[0], row[1]) for row in examples]}")

            
            # Preverjanje, koliko zapisov ima vrsta_oddanih_prostorov = 1 ali 2 (samo za np)
            if data_type == "np":
                try:
                    with self.engine.connect() as conn:
                        count_filtered = conn.execute(text("SELECT COUNT(*) FROM staging.np_del_stavbe WHERE vrsta_oddanih_prostorov IN (1, 2, 16)")).scalar()
                        logger.info(f"Število zapisov v staging.np_del_stavbe z vrsta_oddanih_prostorov IN (1, 2, 16): {count_filtered} od {staging_del_stavbe_count} ({round(count_filtered/staging_del_stavbe_count*100, 2)}%)")
                except Exception as e:
                    logger.warning(f"Napaka pri štetju filtriranih zapisov: {str(e)}")
            
            # Najprej izbrišemo obstoječe podatke samo za to leto (če obstajajo)
            try:
                with self.engine.connect() as conn:
                    trans = conn.begin()
                    try:
                        del_result = conn.execute(text(f"DELETE FROM core.{table_prefix}_del_stavbe WHERE leto = {filter_year}"))
                        posel_result = conn.execute(text(f"DELETE FROM core.{table_prefix}_posel WHERE leto = {filter_year}"))
                        trans.commit()
                        logger.info(f"Obstoječi podatki so bili izbrisani iz core tabel. Izbrisanih {table_prefix}_del_stavbe: {del_result.rowcount}, {table_prefix}_posel: {posel_result.rowcount}")
                    except Exception as e:
                        trans.rollback()
                        logger.error(f"Napaka pri brisanju obstoječih podatkov: {str(e)}")
                        raise
            except Exception as e:
                logger.error(f"Napaka povezave pri brisanju obstoječih podatkov: {str(e)}")
                raise

            # Pretvorba podatkov za posel
            logger.info(f"Pretvarjanje podatkov v core.{table_prefix}_posel")
            try:
                with self.engine.connect() as conn:
                    trans = conn.begin()
                    try:
                        sql_query = get_sql_query(f'{table_prefix}_posel_transform.sql')
                        result = conn.execute(text(sql_query))
                        logger.info(f"Transformacija {table_prefix}_posel: vplivala na {result.rowcount} vrstic")
                        trans.commit()
                    except Exception as e:
                        trans.rollback()
                        logger.error(f"Napaka pri transformaciji {table_prefix}_posel: {str(e)}")
                        raise
            except Exception as e:
                logger.error(f"Napaka povezave pri transformaciji {table_prefix}_posel: {str(e)}")
                raise
            

            # Pretvorba podatkov za del_stavbe
            logger.info(f"Pretvarjanje podatkov v core.{table_prefix}_del_stavbe")
            try:
                with self.engine.connect() as conn:
                    trans = conn.begin()
                    try:
                        sql_query = get_sql_query(f'{table_prefix}_del_stavbe_transform.sql')
                        result = conn.execute(text(sql_query))
                        logger.info(f"Transformacija {table_prefix}_del_stavbe: vplivala na {result.rowcount} vrstic")
                        trans.commit()
                    except Exception as e:
                        trans.rollback()
                        logger.error(f"Napaka pri transformaciji {table_prefix}_del_stavbe: {str(e)}")
                        raise
            except Exception as e:
                logger.error(f"Napaka povezave pri transformaciji {table_prefix}_del_stavbe: {str(e)}")
                raise
            
            
            # Preverjanje števila vnosov v core tabelah
            del_stavbe_count = execute_sql_count(self.engine, 'core', f'{table_prefix}_del_stavbe')
            posel_count = execute_sql_count(self.engine, 'core', f'{table_prefix}_posel')
            
            logger.info(f"Pretvorba podatkov zaključena. Število vrstic: core.{table_prefix}_del_stavbe: {del_stavbe_count}, core.{table_prefix}_posel: {posel_count}")
            
            if del_stavbe_count == 0 or posel_count == 0:
                logger.warning("Transformacija je bila izvedena brez napak, vendar podatki niso bili vstavljeni!")
            
        except Exception as e:
            logger.error(f"Napaka pri pretvorbi v core: {str(e)}")
            raise
    



    def cleanup(self, temp_dir: str):
        """Počisti začasen direktorij."""
        try:
            shutil.rmtree(temp_dir)
            logger.info(f"Začasen direktorij počiščen: {temp_dir}")
        except Exception as e:
            logger.error(f"Napaka pri čiščenju začasnega direktorija: {str(e)}")
    



    async def run_ingestion(self, filter_year: str, data_type: str = "np") -> Dict[str, Any]:
        """Zažene celoten proces vnosa podatkov."""
        try:
            #za async izvajanje
            loop = asyncio.get_event_loop()

            # logger
            year_filter.current_year = filter_year
            year_filter.current_type = data_type

            logger.info("=" + "/" * 50 + '=')

            logger.info(f"Začenjam vnos podatkov tipa {data_type}")
            
            # Prenesi podatke
            zip_path = await self.download_data(filter_year, data_type)
            temp_dir = os.path.dirname(zip_path)

            logger.info("=" * 50)
            
            # Ekstrahiraj datoteke
            csv_files = self.extract_files(zip_path, data_type)

            logger.info("=" * 50)
            
            # Uvozi v staging tabele
            await loop.run_in_executor(
                self.executor,
                self.import_to_staging,
                csv_files
            )

            logger.info("=" * 50)
            
            # Pretvori v core tabele
            await loop.run_in_executor(
                self.executor,
                self.transform_to_core,
                filter_year,
                data_type
            )
            logger.info("=" * 50)
            
            #počisti temp direktorij
            await loop.run_in_executor(
                self.executor,
                self.cleanup,
                temp_dir
            )            

            return {"status": "success", "message": f"Vnos podatkov tipa {data_type} uspešno zaključen"}
            
        except Exception as e:
            logger.error(f"Napaka pri vnosu podatkov: {str(e)}")
            return {"status": "error", "message": str(e)}