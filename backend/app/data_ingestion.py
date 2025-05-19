import os
import requests
import pandas as pd
import tempfile
import logging
import sys
import zipfile
import shutil
from sqlalchemy import create_engine, text
from typing import Dict, Any
import json

from .sql_utils import get_sql_query, execute_sql_file, execute_sql_count

# Nastavitev beleženja
file_handler = logging.FileHandler("data_ingestion.log", encoding='utf-8')
stream_handler = logging.StreamHandler(sys.stdout)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[file_handler, stream_handler]
)
logger = logging.getLogger("data_ingestion")

class DataIngestionService:
    def __init__(self, db_url: str):
        self.db_url = db_url
        self.engine = create_engine(db_url)
        


    async def download_data(self, filter_param: str, filter_value: str, filter_year: str) -> str:
        """Prenese podatke iz API-ja in vrne pot do prenesene datoteke."""
        try:
            api_url = "https://ipi.eprostor.gov.si/jgp-service-api/display-views/groups/127/composite-products/322/file"
            params = {
                "filterParam": filter_param,
                "filterValue": filter_value,
                "filterYear": filter_year
            }
            
            logger.info(f"Prenašanje metapodatkov. Parametri: {params}")
            
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                "Accept": "*/*"
            }
            
            # Pridobivanje URL-ja za prenos iz API-ja
            response = requests.get(api_url, params=params, headers=headers)
            
            if response.status_code != 200:
                logger.error(f"API zahteva je bila neuspešna, status: {response.status_code}, odgovor: {response.text}")
                raise Exception(f"API zahteva je bila neuspešna, status: {response.status_code}")
            
            # Razčlenitev JSON odgovora
            try:
                json_data = response.json()
                
                # Pridobivanje URL-ja za prenos
                if "url" not in json_data:
                    logger.error(f"URL za prenos ni bil najden v odzivu: {json_data}")
                    raise Exception("URL za prenos ni bil najden v odzivu")
                
                download_url = json_data["url"]
                logger.info(f"Najden URL za prenos: {download_url}")
                
                # Prenos ZIP datoteke
                logger.info("Prenašanje ZIP datoteke...")
                file_response = requests.get(download_url, headers=headers, stream=True)
                
                if file_response.status_code != 200:
                    logger.error(f"Prenos datoteke ni uspel, status: {file_response.status_code}")
                    raise Exception(f"Prenos datoteke ni uspel, status: {file_response.status_code}")
                
                # Ustvarjanje začasnega direktorija in shranjevanje datoteke
                temp_dir = tempfile.mkdtemp()
                zip_path = os.path.join(temp_dir, "downloaded_data.zip")
                
                with open(zip_path, 'wb') as f:
                    for chunk in file_response.iter_content(chunk_size=8192):
                        f.write(chunk)
                
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
                
            except json.JSONDecodeError:
                logger.error(f"Odziv ni veljaven JSON: {response.text[:500]}")
                raise Exception("Odziv ni veljaven JSON")
                
        except Exception as e:
            logger.error(f"Napaka pri prenosu podatkov: {str(e)}")
            raise



    def extract_files(self, zip_path: str) -> Dict[str, str]:
        """Razbere datoteke iz ZIP arhiva in vrne poti."""
        try:
            extract_dir = os.path.dirname(zip_path)
            
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)
                
                # Preslikava pričakovanih CSV datotek v tabele
                csv_mapping = {
                    'sifranti': None,
                    'del_stavbe': None,
                    'posel': None
                }
                
                # Iskanje CSV datotek v ekstrahirani vsebini
                for file in zip_ref.namelist():
                    if file.endswith('.csv'):
                        if 'sifranti' in file.lower():
                            csv_mapping['sifranti'] = os.path.join(extract_dir, file)
                        elif 'delistavb' in file.lower():
                            csv_mapping['del_stavbe'] = os.path.join(extract_dir, file)
                        elif 'posli' in file.lower():
                            csv_mapping['posel'] = os.path.join(extract_dir, file)
            
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
            # Ustvarjanje staging tabel
            logger.info("Ustvarjanje staging tabel")
            execute_sql_file(self.engine, 'create_staging_tables.sql')
            
            # Uvoz CSV datotek v ustrezne staging tabele
            for table_name, file_path in csv_files.items():
                if not file_path or not os.path.exists(file_path):
                    logger.warning(f"Datoteka za tabelo {table_name} ne obstaja: {file_path}")
                    continue
                    
                logger.info(f"Uvažanje {file_path} v staging.{table_name}")
                
                # Branje CSV datoteke z ustreznim kodiranjem
                try:
                    for encoding in ['utf-8', 'latin1', 'cp1250']:
                        try:
                            df = pd.read_csv(file_path, encoding=encoding)
                            logger.info(f"Uspešno prebrana datoteka s kodiranjem {encoding}")
                            break
                        except UnicodeDecodeError:
                            logger.warning(f"Napaka pri branju z {encoding}, poskušam drugo kodiranje")
                            continue
                    else:
                        logger.error("Ni bilo mogoče prebrati datoteke z nobenim kodiranjem")
                        continue
                    
                    # Preimenovanje stolpcev v male črke
                    df.columns = [col.lower() for col in df.columns]
                    
                    # Nalaganje podatkov v staging tabelo
                    df.to_sql(
                        name=table_name,
                        schema="staging",
                        con=self.engine,
                        if_exists="replace",
                        index=False
                    )
                    
                    # Preverjanje uspešnosti uvoza
                    row_count = execute_sql_count(self.engine, 'staging', table_name)
                    logger.info(f"Uspešno naloženih {row_count} vrstic v staging.{table_name}")
                    
                except Exception as e:
                    logger.error(f"Napaka pri uvozu datoteke {file_path}: {str(e)}")
                    raise
                    
        except Exception as e:
            logger.error(f"Napaka pri uvozu v staging: {str(e)}")
            raise



    def transform_to_core(self):
        """Pretvori podatke iz staging v core tabele."""
        try:
            # Brisanje obstoječih podatkov iz core tabel
            logger.info("Brisanje obstoječih podatkov iz core tabel")
            execute_sql_file(self.engine, 'truncate_tables.sql')
            
            # Preverjanje, ali so staging tabele napolnjene
            staging_del_stavbe_count = execute_sql_count(self.engine, 'staging', 'del_stavbe')
            staging_posel_count = execute_sql_count(self.engine, 'staging', 'posel')
            logger.info(f"Podatki v staging: del_stavbe={staging_del_stavbe_count}, posel={staging_posel_count}")
            
            if staging_del_stavbe_count == 0 or staging_posel_count == 0:
                logger.warning("Staging tabele so prazne! Ne morem nadaljevati s transformacijo.")
                return
            
            # Preverjanje, ali PostGIS deluje pravilno
            try:
                with self.engine.connect() as conn:
                    postgis_check = conn.execute(text("SELECT PostGIS_version();")).scalar()
                    logger.info(f"PostGIS verzija: {postgis_check}")
            except Exception as e:
                logger.warning("PostGIS morda ni pravilno nameščen, kar lahko povzroči težave.")
            
            # Pretvorba podatkov za del_stavbe
            logger.info("Pretvarjanje podatkov v core.del_stavbe")
            try:
                with self.engine.connect() as conn:
                    trans = conn.begin()
                    try:
                        sql_query = get_sql_query('del_stavbe_transform.sql')
                        result = conn.execute(text(sql_query))
                        logger.info(f"Transformacija del_stavbe: vplivala na {result.rowcount} vrstic")
                        trans.commit()
                    except Exception as e:
                        trans.rollback()
                        logger.error(f"Napaka pri transformaciji del_stavbe: {str(e)}")
                        raise
            except Exception as e:
                logger.error(f"Napaka povezave pri transformaciji del_stavbe: {str(e)}")
                raise
            
            # Pretvorba podatkov za posel
            logger.info("Pretvarjanje podatkov v core.posel")
            try:
                with self.engine.connect() as conn:
                    trans = conn.begin()
                    try:
                        sql_query = get_sql_query('posel_transform.sql')
                        result = conn.execute(text(sql_query))
                        logger.info(f"Transformacija posel: vplivala na {result.rowcount} vrstic")
                        trans.commit()
                    except Exception as e:
                        trans.rollback()
                        logger.error(f"Napaka pri transformaciji posel: {str(e)}")
                        raise
            except Exception as e:
                logger.error(f"Napaka povezave pri transformaciji posel: {str(e)}")
                raise
            
            # Preverjanje števila vnosov v core tabelah
            del_stavbe_count = execute_sql_count(self.engine, 'core', 'del_stavbe')
            posel_count = execute_sql_count(self.engine, 'core', 'posel')
            
            logger.info(f"Pretvorba podatkov zaključena. Število vrstic: core.del_stavbe: {del_stavbe_count}, core.posel: {posel_count}")
            
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
    


    async def run_ingestion(self, filter_param: str, filter_value: str, filter_year: str) -> Dict[str, Any]:
        """Zažene celoten proces vnosa podatkov."""
        try:
            zip_path = await self.download_data(filter_param, filter_value, filter_year)
            temp_dir = os.path.dirname(zip_path)
            
            csv_files = self.extract_files(zip_path)
            
            self.import_to_staging(csv_files)
            
            self.transform_to_core()
            
            self.cleanup(temp_dir)
            
            return {"status": "success", "message": "Vnos podatkov uspešno zaključen"}
            
        except Exception as e:
            logger.error(f"Napaka pri vnosu podatkov: {str(e)}")
            return {"status": "error", "message": str(e)}