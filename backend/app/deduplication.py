import logging
import sys
from sqlalchemy import create_engine, text
from .sql_utils import get_sql_query, execute_sql_count


def setup_logger(name: str, log_file: str, prefix: str):
    """Nastavi logger z datoteko in konzolo."""
    logger = logging.getLogger(name)
    
    if logger.handlers:
        return logger
        
    logger.setLevel(logging.INFO)
    formatter = logging.Formatter(f'%(asctime)s - %(levelname)s - [{prefix}] - %(message)s')
    
    for handler in [
        logging.FileHandler(log_file, encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]:
        handler.setLevel(logging.INFO)
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    
    logger.propagate = False
    return logger

# Setup logger na vrhu modula
logger = setup_logger("deduplication", "deduplication.log", "DEDUP")


class DeduplicationService:
    """
    Storitev za ustvarjanje deduplicirane tabele lastnosti.
    To se izvršuje ENKRAT na koncu celotnega procesa vnosa za vsa leta.
    """
    
    def __init__(self, db_url: str):
        self.db_url = db_url
        self.engine = create_engine(db_url)

    
    def create_deduplicated_properties(self, data_type: str):
        """
        Ustvari deduplicirane lastnosti za prikaz na zemljevidu z uporabo VSEH podatkov vseh let.
        To naj se izvršuje ENKRAT potem, ko so vsa leta vnešena.
        """
        try:
            table_prefix = data_type.lower()
            logger.info(f"Ustvarjam deduplicirane lastnosti za VSE {table_prefix} podatke")
            
            # Korak 1: Popolnoma očisti obstoječe deduplicirane podatke
            self._clear_deduplicated_table(table_prefix)
            
            # Korak 2: Zaženi dedupliciranje SQL za obdelavo VSEH let naenkrat
            self._run_deduplication_sql(table_prefix)
            
            # Korak 3: Preveri rezultate
            self._verify_deduplication_results(table_prefix)
            
            logger.info(f"Dedupliciranje uspešno dokončano za {table_prefix}")
            
        except Exception as e:
            logger.error(f"Napaka pri ustvarjanju dedupliciranih lastnosti za {data_type}: {str(e)}")
            raise
    
    def _clear_deduplicated_table(self, table_prefix: str):
        """Očisti celotno deduplicirano tabelo za sveže podatke"""
        try:
            with self.engine.connect() as conn:
                trans = conn.begin()
                try:
                    delete_sql = f"TRUNCATE TABLE core.{table_prefix}_del_stavbe_deduplicated"
                    conn.execute(text(delete_sql))
                    trans.commit()
                    logger.info(f"Očiščena obstoječa deduplicirana tabela: {table_prefix}_del_stavbe_deduplicated")
                except Exception as e:
                    trans.rollback()
                    logger.error(f"Napaka pri čiščenju deduplicirane tabele: {str(e)}")
                    raise
        except Exception as e:
            logger.error(f"Napaka povezave z bazo podatkov pri čiščenju tabele: {str(e)}")
            raise
    
    def _run_deduplication_sql(self, table_prefix: str):
        """Zaženi SQL za dedupliciranje za obdelavo vseh podatkov"""
        try:
            with self.engine.connect() as conn:
                trans = conn.begin()
                try:
                    sql_query = get_sql_query(f'{table_prefix}_del_stavbe_deduplication.sql')
                    result = conn.execute(text(sql_query))
                    logger.info(f"Dedupliciranje {table_prefix}_del_stavbe: ustvarjenih {result.rowcount} dedupliciranih lastnosti")
                    trans.commit()
                except Exception as e:
                    trans.rollback()
                    logger.error(f"Napaka pri izvrševanju SQL za dedupliciranje: {str(e)}")
                    raise
        except Exception as e:
            logger.error(f"Napaka povezave z bazo podatkov med dedupliciranjem: {str(e)}")
            raise

    def _update_energetske_izkaznice(self):
        """Posodobi energetske izkaznice v deduplikacijskih tabelah"""
        try:
            logger.info("Posodabljam energetske izkaznice v deduplikacijskih tabelah")
            
            with self.engine.connect() as conn:
                trans = conn.begin()
                try:
                    sql_query = get_sql_query('dodaj_ei_deduplication.sql')
                    result = conn.execute(text(sql_query))
                    logger.info("Energetske izkaznice uspešno posodobljene v vseh deduplikacijskih tabelah")
                    trans.commit()
                except Exception as e:
                    trans.rollback()
                    logger.error(f"Napaka pri posodabljanju energetskih izkaznic: {str(e)}")
                    raise
        except Exception as e:
            logger.error(f"Napaka povezave z bazo podatkov pri posodabljanju energetskih izkaznic: {str(e)}")
            raise
    
    def _verify_deduplication_results(self, table_prefix: str):
        """Preveri rezultate dedupliciranja in zabeleži statistike"""
        try:
            # Preštej deduplicirane lastnosti
            dedup_count = execute_sql_count(self.engine, 'core', f'{table_prefix}_del_stavbe_deduplicated')
            
            # Preštej originalne del_stavbe zapise
            original_count = execute_sql_count(self.engine, 'core', f'{table_prefix}_del_stavbe')
            
            # Preštej originalne posel zapise
            posel_count = execute_sql_count(self.engine, 'core', f'{table_prefix}_posel')
            
            # Izračunaj razmerje dedupliciranja
            if original_count > 0:
                dedup_ratio = (original_count - dedup_count) / original_count * 100
            else:
                dedup_ratio = 0
            
            logger.info(f"Rezultati dedupliciranja za {table_prefix}:")
            logger.info(f"  - Originalni del_stavbe zapisi: {original_count:,}")
            logger.info(f"  - Originalni posel zapisi: {posel_count:,}")
            logger.info(f"  - Deduplicirane lastnosti: {dedup_count:,}")
            logger.info(f"  - Razmerje dedupliciranja: {dedup_ratio:.1f}%")
            
            if dedup_count == 0:
                logger.warning(f"Nobene deduplicirane lastnosti ustvarjene za {table_prefix}!")
            elif dedup_count > original_count:
                logger.warning("Več dedupliciranih lastnosti kot originalnih zapisov - preveri logiko!")
            
        except Exception as e:
            logger.error(f"Napaka pri preverjanju rezultatov dedupliciranja: {str(e)}")
            # Ne sproži napake - to je samo preverjanje
    
    def create_all_deduplicated_properties(self, data_types: list = None):
        """
        Ustvari deduplicirane lastnosti za več tipov podatkov.
        """
        if data_types is None:
            data_types = ["np", "kpp"]
        
        logger.info("=" * 60)
        logger.info("ZAČETEK DEDUPLICIRANJA LASTNOSTI")
        logger.info("=" * 60)
        
        for data_type in data_types:
            try:
                logger.info("=" * 50)
                logger.info(f"Obdelujem dedupliciranje za {data_type.upper()}")
                self.create_deduplicated_properties(data_type)
            except Exception as e:
                logger.error(f"Neuspešno ustvarjanje dedupliciranih lastnosti za {data_type}: {str(e)}")
                # Nadaljuj z drugimi tipi podatkov, tudi če eden ne uspe
                continue

        # Posodobi energetske izkaznice za vse deduplicirane lastnosti na koncu
        logger.info("=" * 50)
        logger.info("Posodabljam energetske izkaznice za vse deduplicirane lastnosti")
        try:
            self._update_energetske_izkaznice()
        except Exception as e:
            logger.error(f"Napaka pri posodabljanju energetskih izkaznic: {str(e)}")
            # Ne prekinjaj procesa, samo zabeleži napako

        
        logger.info("=" * 60)
        logger.info("DEDUPLICIRANJE USPEŠNO ZAKLJUČENO")
        logger.info("=" * 60)
    
    def get_deduplication_stats(self, data_type: str = None):
        """
        Pridobi statistike o rezultatih dedupliciranja.
        """
        stats = {}
        
        if data_type:
            data_types = [data_type]
        else:
            data_types = ["np", "kpp"]
        

        for dt in data_types:
            try:
                table_prefix = dt.lower()
                
                # Pridobi števila
                original_count = execute_sql_count(self.engine, 'core', f'{table_prefix}_del_stavbe')
                posel_count = execute_sql_count(self.engine, 'core', f'{table_prefix}_posel')
                dedup_count = execute_sql_count(self.engine, 'core', f'{table_prefix}_del_stavbe_deduplicated')
                
                # Izračunaj razmerje
                if original_count > 0:
                    dedup_ratio = (original_count - dedup_count) / original_count * 100
                else:
                    dedup_ratio = 0
                
                stats[dt] = {
                    "original_del_stavbe": original_count,
                    "original_posel": posel_count,
                    "deduplicated_properties": dedup_count,
                    "deduplication_ratio_percent": round(dedup_ratio, 1)
                }
                
                logger.info(f"Statistike za {dt.upper()}:")
                logger.info(f"  - Del stavbe zapisi: {original_count:,}")
                logger.info(f"  - Posel zapisi: {posel_count:,}")
                logger.info(f"  - Deduplicirane lastnosti: {dedup_count:,}")
                logger.info(f"  - Razmerje dedupliciranja: {dedup_ratio:.1f}%")
                
            except Exception as e:
                logger.error(f"Napaka pri pridobivanju statistik za {dt}: {str(e)}")
                stats[dt] = {"error": str(e)}
        
        return stats