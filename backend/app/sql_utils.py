import os
from sqlalchemy import text
import logging

logger = logging.getLogger("data_ingestion")

def get_sql_query(filename):
    """Prebere SQL poizvedbo iz datoteke."""
    sql_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sql')
    query_path = os.path.join(sql_dir, filename)
    
    with open(query_path, 'r', encoding='utf-8') as f:
        query = f.read()
    
    return query

def execute_sql_file(engine, filename, params=None):
    """Izvede SQL poizvedbo iz datoteke.
    
    Args:
        engine: SQLAlchemy engine
        filename: Ime SQL datoteke v mapi 'sql'
        params: Slovar parametrov za SQL poizvedbo (opcijsko)
        
    Returns:
        Rezultat izvajanja SQL poizvedbe
    """
    query = get_sql_query(filename)
    logger.info(f"Izvajanje SQL datoteke: {filename}")
    
    try:
        with engine.connect() as conn:
            # Začetek transakcije
            trans = conn.begin()
            try:
                if params:
                    logger.info(f"Izvajanje SQL s parametri: {params}")
                    result = conn.execute(text(query), params)
                else:
                    result = conn.execute(text(query))
                
                # Preverjanje vpliva na vrstice
                if hasattr(result, 'rowcount'):
                    logger.info(f"SQL operacija vplivala na {result.rowcount} vrstic")
                
                # Potrditev transakcije
                trans.commit()
                logger.info(f"SQL uspešno zaključen in potrjen: {filename}")
                return result
            except Exception as e:
                # Razveljavitev ob napaki
                trans.rollback()
                logger.error(f"SQL napaka pri izvajanju {filename}: {str(e)}")
                
                # Beleženje podrobnejših informacij o napaki
                if hasattr(e, 'orig') and e.orig:
                    logger.error(f"Izvirna napaka: {str(e.orig)}")
                
                raise
    except Exception as e:
        logger.error(f"Napaka povezave pri izvajanju {filename}: {str(e)}")
        raise

def execute_sql_count(engine, schema, table):
    """Vrne število vrstic v tabeli.
    
    Args:
        engine: SQLAlchemy engine
        schema: Ime sheme
        table: Ime tabele
        
    Returns:
        Število vrstic v tabeli
    """
    count_query = f"SELECT COUNT(*) FROM {schema}.{table}"
    logger.info(f"Štetje vrstic v {schema}.{table}")
    
    try:
        with engine.connect() as conn:
            result = conn.execute(text(count_query)).scalar()
            logger.info(f"Število vrstic v {schema}.{table}: {result}")
            return result
    except Exception as e:
        logger.error(f"Napaka pri štetju vrstic v {schema}.{table}: {str(e)}")
        if hasattr(e, 'orig') and e.orig:
            logger.error(f"Izvirna napaka: {str(e.orig)}")
        raise

def execute_sql_query(engine, query, params=None):
    """Izvede poljubno SQL poizvedbo.
    
    Args:
        engine: SQLAlchemy engine
        query: SQL poizvedba
        params: Slovar parametrov za SQL poizvedbo (opcijsko)
        
    Returns:
        Rezultat izvajanja SQL poizvedbe
    """
    short_query = query[:100] + "..." if len(query) > 100 else query
    logger.info(f"Izvajanje SQL poizvedbe: {short_query}")
    
    try:
        with engine.connect() as conn:
            # Začetek transakcije
            trans = conn.begin()
            try:
                if params:
                    logger.info(f"Izvajanje SQL s parametri: {params}")
                    result = conn.execute(text(query), params)
                else:
                    result = conn.execute(text(query))
                
                # Preverjanje vpliva na vrstice
                if hasattr(result, 'rowcount'):
                    logger.info(f"SQL operacija vplivala na {result.rowcount} vrstic")
                
                # Potrditev transakcije
                trans.commit()
                logger.info(f"SQL poizvedba uspešno zaključena in potrjena")
                return result
            except Exception as e:
                # Razveljavitev ob napaki
                trans.rollback()
                logger.error(f"SQL napaka pri izvajanju poizvedbe: {str(e)}")
                
                # Beleženje podrobnejših informacij o napaki
                if hasattr(e, 'orig') and e.orig:
                    logger.error(f"Izvirna napaka: {str(e.orig)}")
                
                raise
    except Exception as e:
        logger.error(f"Napaka povezave pri izvajanju SQL poizvedbe: {str(e)}")
        raise