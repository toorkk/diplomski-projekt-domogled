import os
import requests
import pandas as pd
import tempfile
from datetime import datetime
from .logging_utils import setup_logger
from sqlalchemy import QueuePool, create_engine, text
from typing import Dict, Any
import shutil
from .sql_utils import execute_sql_file, execute_sql_count


logger = setup_logger("ei_ingestion", "energetska_izkaznica_ingestion.log", "EI")


class EnergetskaIzkaznicaIngestionService:
    def __init__(self, db_url: str):
        self.db_url = db_url
        self.engine = create_engine(
            db_url,
            poolclass=QueuePool,
            pool_size=5,
            max_overflow=10,
            pool_pre_ping=True,
            pool_recycle=300,  # 5 minut
            connect_args={
                "connect_timeout": 60,
                "options": "-c statement_timeout=300000"  # 5 minut za SQL
            }
        )

    def generate_current_url(self) -> str:
        """Generiraj URL za trenutni mesec in leto."""
        now = datetime.now()
        
        months = [
            "jan", "feb", "mar", "apr", "maj", "jun",
            "jul", "avg", "sep", "okt", "nov", "dec"
        ]
        
        current_month = months[now.month - 1]
        current_year = str(now.year)[2:]
        
        filename = f"ei_javni_register_{current_month}{current_year}.csv"
        url = f"https://www.energetika-portal.si/fileadmin/dokumenti/podrocja/energetika/energetske_izkaznice/{filename}"
        
        return url


    def download_csv(self, url: str = None) -> str:
        """Prenesi CSV datoteko iz URL-ja."""
        try:

            if url is None:
                url = self.generate_current_url()
            

            logger.info(f"Prenašanje CSV datoteke iz: {url}")
            response = requests.get(url, stream=True)
            

            if response.status_code != 200:
                logger.error(f"Napaka pri prenosu: status {response.status_code}")
                raise Exception(f"Napaka pri prenosu datoteke, status: {response.status_code}")
            

            temp_dir = tempfile.mkdtemp()
            csv_path = os.path.join(temp_dir, "energetska_izkaznica.csv")
            
            with open(csv_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            

            file_size = os.path.getsize(csv_path)
            logger.info(f"CSV datoteka prenesena: {file_size} bajtov")
            
            return csv_path
            
        except Exception as e:
            logger.error(f"Napaka pri prenosu CSV: {str(e)}")
            raise


    def clean_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Počisti in pripravi podatke za uvoz."""
        try:
            logger.info(f"Čiščenje podatkov - začetno število vrstic: {len(df)}")
            
            df.columns = df.columns.str.strip()
            
            df = df.replace('', None)

            df = df[df['ID energetske izkaznice'].notna()]
            
            
            numeric_columns = [
                'Potrebna toplota za ogrevanje',
                'Dovedena energija za delovanje stavbe', 
                'Celotna energija',
                'Dovedena električna energija',
                'Primarna energija',
                'Emisije CO2',
                'Kondicionirana površina stavbe'
            ]
            for col in numeric_columns:
                if col in df.columns:
                    df[col] = df[col].astype(str).str.replace('.', '', regex=False)
                    df[col] = df[col].astype(str).str.replace(',', '.', regex=False)
                    df[col] = pd.to_numeric(df[col], errors='coerce')
            

            date_columns = ['Datum izdelave', 'Velja do']
            for col in date_columns:
                if col in df.columns:
                    df[col] = pd.to_datetime(df[col], format='%d.%m.%Y', errors='coerce')
            

            filtered_count = len(df)
            logger.info(f"Po filtriranju veljavnih ID-jev: {filtered_count}")
            
            return df
            
        except Exception as e:
            logger.error(f"Napaka pri čiščenju podatkov: {str(e)}")
            raise

    def import_to_staging(self, df: pd.DataFrame) -> int:
        """Uvozi podatke v staging tabelo."""
        try:
            logger.info(f"Uvažanje {len(df)} zapisov v staging tabelo")
            
            column_mapping = {
                'ID energetske izkaznice': 'ei_id',
                'Datum izdelave': 'datum_izdelave',
                'Velja do': 'velja_do', 
                'Šifra KO': 'sifra_ko',
                'Številka stavbe': 'stevilka_stavbe',
                'Številka dela stavbe': 'stevilka_dela_stavbe',
                'Tip izkaznice': 'tip_izkaznice',
                'Potrebna toplota za ogrevanje': 'potrebna_toplota_ogrevanje',
                'Dovedena energija za delovanje stavbe': 'dovedena_energija_delovanje',
                'Celotna energija': 'celotna_energija',
                'Dovedena električna energija': 'dovedena_elektricna_energija',
                'Primarna energija': 'primarna_energija',
                'Emisije CO2': 'emisije_co2',
                'Kondicionirana površina stavbe': 'kondicionirana_povrsina',
                'Energijski razred': 'energijski_razred',
                'EPBD': 'epbd_tip'
            }
            
            df_renamed = df.rename(columns=column_mapping)
            
            # Obdrži samo stolpce ki obstajajo v tabeli
            table_columns = list(column_mapping.values())
            df_final = df_renamed[table_columns].copy()
            
            # Počisti staging tabelo in vstavi nove podatke
            with self.engine.connect() as conn:
                trans = conn.begin()
                try:
                    logger.info("Čiščenje staging tabele...")
                    truncate_sql = "TRUNCATE TABLE staging.energetska_izkaznica;"
                    conn.execute(text(truncate_sql))
                    
                    df_final.to_sql(
                        name='energetska_izkaznica',
                        schema='staging',
                        con=conn,
                        if_exists='append',
                        index=False,
                        chunksize=1000,
                        method='multi'
                    )

                    trans.commit()
                    
                    staging_count = execute_sql_count(self.engine, 'staging', 'energetska_izkaznica')
                    logger.info(f"Uspešno naloženih {staging_count} zapisov v staging tabelo")
                    
                    return staging_count
                    
                except Exception as e:
                    trans.rollback()
                    logger.error(f"Napaka pri uvozu v staging: {str(e)}")
                    raise
                    
        except Exception as e:
            logger.error(f"Napaka pri uvozu v staging tabelo: {str(e)}")
            raise

    def transform_to_core(self) -> int:
        """Zamenja celotno core tabelo z novimi podatki iz staging tabele."""
        try:
            logger.info("Zamenjava celotne core tabele z novimi podatki")
            
            staging_count = execute_sql_count(self.engine, 'staging', 'energetska_izkaznica')
            
            if staging_count == 0:
                logger.warning("Staging tabela je prazna! Ne morem nadaljevati s transformacijo.")
                return 0
            
            logger.info(f"Zamenjavanje core tabele z {staging_count} zapisi iz staging tabele")
            
            # Izvedi SQL skripto za zamenjavo tabele
            execute_sql_file(self.engine, 'ei_insert.sql')
                    
            core_count = execute_sql_count(self.engine, 'core', 'energetska_izkaznica')
            logger.info(f"Uspešno zamenjanih {core_count} zapisov v core tabeli")
            
            return core_count
                    
        except Exception as e:
            logger.error(f"Napaka pri transformaciji v core tabelo: {str(e)}")
            raise

    def cleanup(self, file_path: str):
        """Počisti začasne datoteke."""
        try:
            temp_dir = os.path.dirname(file_path)
            shutil.rmtree(temp_dir)
            logger.info(f"Počiščen začasen direktorij: {temp_dir}")
        except Exception as e:
            logger.warning(f"Napaka pri čiščenju: {str(e)}")

    def run_ingestion(self, url: str = None) -> Dict[str, Any]:
        """Zaženi celoten proces uvoza energetskih izkaznic."""
        csv_path = None
        try:
            logger.info("=" * 60)
            logger.info("ZAČETEK UVOZA ENERGETSKIH IZKAZNIC")
            logger.info("=" * 60)
            
            csv_path = self.download_csv(url)
            
            logger.info("Branje CSV datoteke...")
            df = pd.read_csv(csv_path, delimiter='|', encoding='utf-8', low_memory=False)
            logger.info(f"Prebrano {len(df)} vrstic iz CSV")
            
            df_clean = self.clean_data(df)
            
            logger.info("=" * 50)
            staging_count = self.import_to_staging(df_clean)
            
            logger.info("=" * 50)
            core_count = self.transform_to_core()
            
            self.cleanup(csv_path)
            
            logger.info("=" * 60)
            logger.info("UVOZ ENERGETSKIH IZKAZNIC USPEŠNO ZAKLJUČEN")
            logger.info("=" * 60)
            
            return {
                "status": "success",
                "message": f"Uspešno uvoženih {core_count} energetskih izkaznic",
                "records_imported": core_count,
                "staging_records": staging_count
            }
            
        except Exception as e:
            if csv_path:
                self.cleanup(csv_path)
            
            logger.error(f"NAPAKA PRI UVOZU: {str(e)}")
            return {
                "status": "error", 
                "message": str(e)
            }