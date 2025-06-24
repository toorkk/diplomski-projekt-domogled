from typing import Dict, Any
from sqlalchemy import create_engine, text
from .logging_utils import setup_logger
from .sql_utils import get_sql_query

logger = setup_logger("statistics", "statistics.log", "STATS")


class StatisticsService:
    
    def __init__(self, db_url: str):
        self.db_url = db_url
        self.engine = create_engine(db_url)

    def refresh_all_statistics(self) -> Dict[str, Any]:
        """
        Napolni/posodobi vse statistike za vse regije
        """
        try:
            logger.info("=" * 60)
            logger.info("ZAČETEK POSODABLJANJA VSEH STATISTIK")
            logger.info("=" * 60)
            
            logger.info("Posodabljam statistike za vse regije")
            
            # 1. Posodobi materialized views
            self._refresh_materialized_views()
            
            # 2. Počisti cache
            self._clear_cache()
            
            # 3. Polni cache z vsemi statistikami
            self._populate_all_cache()
            
            # 4. Preveri rezultate
            status = self.get_statistics_status()
            
            logger.info("=" * 60)
            logger.info("VSE STATISTIKE USPEŠNO POSODOBLJENE")
            logger.info("=" * 60)
            
            return {
                "status": "success", 
                "message": "Vse statistike uspešno posodobljene", 
                "details": status["statistics"]
            }
            
        except Exception as e:
            logger.error(f"Napaka pri posodabljanju statistik: {str(e)}")
            return {"status": "error", "message": str(e)}

    def get_statistics_status(self) -> Dict[str, Any]:
        """
        Status statistik
        """
        try:
            with self.engine.connect() as conn:
                # Osnovne statistike o cache
                cache_count = conn.execute(text("SELECT COUNT(*) FROM stats.statistike_cache")).scalar()
                
                regions_count = conn.execute(text(
                    "SELECT COUNT(DISTINCT ime_regije) FROM stats.statistike_cache"
                )).scalar()
                
                # Razdelitev po tipih
                razdelitev_query = """
                SELECT 
                    tip_posla,
                    tip_obdobja,
                    COUNT(*) as stevilo
                FROM stats.statistike_cache 
                GROUP BY tip_posla, tip_obdobja
                ORDER BY tip_posla, tip_obdobja
                """
                
                result = conn.execute(text(razdelitev_query))
                razdelitev = [{"tip_posla": row.tip_posla, "tip_obdobja": row.tip_obdobja, "stevilo": row.stevilo} 
                           for row in result.fetchall()]
                
                # Materialized views
                try:
                    mv_prodajne_count = conn.execute(text("SELECT COUNT(*) FROM stats.mv_prodajne_statistike")).scalar()
                    mv_najemne_count = conn.execute(text("SELECT COUNT(*) FROM stats.mv_najemne_statistike")).scalar()
                except:
                    mv_prodajne_count = 0
                    mv_najemne_count = 0
                
                return {
                    "status": "success",
                    "statistics": {
                        "cache_zapisov": cache_count,
                        "stevilo_regij": regions_count,
                        "mv_prodajni_zapisi": mv_prodajne_count,
                        "mv_najemni_zapisi": mv_najemne_count,
                        "razdelitev_po_tipih": razdelitev
                    }
                }
                
        except Exception as e:
            logger.error(f"Napaka pri pridobivanju statusa: {str(e)}")
            return {"status": "error", "message": str(e)}

    def get_full_statistics(self, regija: str, tip_regije: str = "obcina") -> Dict[str, Any]:
        """
        Pridobi VSE statistike za določeno regijo/KO/Slovenijo
        """
        try:
            with self.engine.connect() as conn:
                # Pridobi vse statistike za regijo
                query = """
                SELECT *
                FROM stats.statistike_cache 
                WHERE tip_regije = :tip_regije AND ime_regije = :regija
                ORDER BY tip_posla, vrsta_nepremicnine, tip_obdobja, leto DESC
                """
                
                result = conn.execute(text(query), {"tip_regije": tip_regije, "regija": regija})
                rows = result.fetchall()
                
                if not rows:
                    return {"status": "error", "message": f"Statistike za regijo '{regija}' niso najdene"}
                
                # Organiziraj podatke po strukturah
                statistike = {
                    "prodaja": {
                        "stanovanje": {"letno": [], "zadnjih_12m": None},
                        "hisa": {"letno": [], "zadnjih_12m": None}
                    },
                    "najem": {
                        "stanovanje": {"letno": [], "zadnjih_12m": None},
                        "hisa": {"letno": [], "zadnjih_12m": None}
                    },
                }
                
                for row in rows:
                    # Struktura podatkov za vsak zapis
                    podatek = {
                        "leto": row.leto,
                        "cene": {
                            "povprecna_cena_m2": float(row.povprecna_cena_m2) if row.povprecna_cena_m2 else None,
                            "povprecna_skupna_cena": float(row.povprecna_skupna_cena) if row.povprecna_skupna_cena else None,
                        },
                        "aktivnost": {
                            "stevilo_poslov": row.stevilo_poslov,
                            "aktivna_v_letu": row.aktivna_v_letu
                        },
                        "lastnosti": {
                            "povprecna_velikost_m2": float(row.povprecna_velikost_m2) if row.povprecna_velikost_m2 else None,
                            "povprecna_starost_stavbe": row.povprecna_starost_stavbe,
                        }
                    }
                    
                    # Razporedi v ustrezno kategorijo
                    tip_trans = row.tip_posla
                    vrsta_nep = row.vrsta_nepremicnine
                    tip_obd = row.tip_obdobja
                    
                    if tip_obd == "letno":
                        statistike[tip_trans][vrsta_nep]["letno"].append(podatek)
                    else:  # zadnjih_12m
                        statistike[tip_trans][vrsta_nep]["zadnjih_12m"] = podatek
                    
                return {"status": "success", "statistike": statistike}
                
        except Exception as e:
            logger.error(f"Napaka pri pridobivanju statistik za regijo {regija}: {str(e)}")
            return {"status": "error", "message": str(e)}

    def get_general_statistics(self, regija: str, tip_regije: str = "obcina") -> Dict[str, Any]:
        """
        Pridobi samo splošne/ključne statistike za regijo
        """
        try:
            with self.engine.connect() as conn:
                query = """
                SELECT 
                    ime_regije,
                    vrsta_nepremicnine,
                    tip_posla,
                    povprecna_cena_m2,
                    povprecna_skupna_cena,
                    stevilo_poslov,
                    aktivna_v_letu,
                    povprecna_velikost_m2,
                    povprecna_starost_stavbe
                FROM stats.statistike_cache 
                WHERE tip_regije = :tip_regije 
                  AND ime_regije = :regija
                  AND tip_obdobja = 'letno'
                  AND leto = 2025
                ORDER BY tip_posla, vrsta_nepremicnine
                """
                
                result = conn.execute(text(query), {"tip_regije": tip_regije, "regija": regija})
                rows = result.fetchall()
                
                if not rows:
                    return {"status": "error", "message": f"Splošne statistike za regijo '{regija}' niso najdene"}
                
                splosne = {
                    "regija": regija,
                    "tip_regije": tip_regije,
                    "obdobje": "zadnjih_12_mesecev",
                    "pregled": {},
                }
                
                for row in rows:
                    key = f"{row.tip_posla}_{row.vrsta_nepremicnine}"
                    splosne["pregled"][key] = {
                        "tip_posla": row.tip_posla,
                        "vrsta_nepremicnine": row.vrsta_nepremicnine,
                        "povprecna_cena_m2": float(row.povprecna_cena_m2) if row.povprecna_cena_m2 else None,
                        "povprecna_skupna_cena": float(row.povprecna_skupna_cena) if row.povprecna_skupna_cena else None,
                        "stevilo_poslov": row.stevilo_poslov,
                        "aktivna_v_letu": row.aktivna_v_letu,
                        "povprecna_velikost_m2": float(row.povprecna_velikost_m2) if row.povprecna_velikost_m2 else None,
                        "povprecna_starost_stavbe": row.povprecna_starost_stavbe
                    }
                
                return {"status": "success", "splosne_statistike": splosne}
                
        except Exception as e:
            logger.error(f"Napaka pri pridobivanju splošnih statistik za regijo {regija}: {str(e)}")
            return {"status": "error", "message": str(e)}
        

def get_all_obcine_posli_2025(self, vkljuci_katastrske: bool = True) -> Dict[str, Any]:
    """
    Pridobi število poslov za leto 2025 za VSE občine + katastrske občine za Ljubljano in Maribor
    
    Args:
        vkljuci_katastrske: Ali naj vključi tudi katastrske občine za LJ in MB
    
    Returns:
        Dict s podatki za vse občine + katastrske občine organizirane po imenih
    """
    try:
        with self.engine.connect() as conn:
            # Osnovni query za občine
            query_obcine = """
            SELECT 
                ime_regije,
                tip_posla,
                vrsta_nepremicnine,
                'obcina' as tip_regije_oznaka,
                SUM(stevilo_poslov) as skupaj_poslov
            FROM stats.statistike_cache 
            WHERE leto = :leto
                AND tip_regije = 'obcina'
            GROUP BY ime_regije, tip_posla, vrsta_nepremicnine
            """
            
            # Query za katastrske občine (samo Ljubljana in Maribor)
            query_katastrske = """
            SELECT 
                ime_regije,
                tip_posla,
                vrsta_nepremicnine,
                'kat_obcina' as tip_regije_oznaka,
                SUM(stevilo_poslov) as skupaj_poslov
            FROM stats.statistike_cache 
            WHERE leto = :leto
                AND tip_regije = 'kat_obcina'
                AND ime_regije LIKE '%Ljubljana%' OR ime_regije LIKE '%Maribor%'
            GROUP BY ime_regije, tip_posla, vrsta_nepremicnine
            """
            
            # Kombiniran query z UNION ALL
            if vkljuci_katastrske:
                final_query = f"""
                {query_obcine}
                UNION ALL
                {query_katastrske}
                ORDER BY ime_regije, tip_posla, vrsta_nepremicnine
                """
            else:
                final_query = f"{query_obcine} ORDER BY ime_regije, tip_posla, vrsta_nepremicnine"
            
            result = conn.execute(text(final_query), {"leto": 2025})
            rows = result.fetchall()
            
            logger.info(f"Found {len(rows)} rows for občine + katastrske posli 2025")
            
            if not rows:
                # Error handling kot prej
                test_query = "SELECT COUNT(*) as count FROM stats.statistike_cache LIMIT 1"
                test_result = conn.execute(text(test_query))
                table_exists = test_result.fetchone()
                
                if not table_exists:
                    return {
                        "status": "error",
                        "message": "Tabela stats.statistike_cache ne obstaja"
                    }
                
                years_query = "SELECT DISTINCT leto FROM stats.statistike_cache ORDER BY leto"
                years_result = conn.execute(text(years_query))
                available_years = [row[0] for row in years_result.fetchall()]
                
                return {
                    "status": "error", 
                    "message": f"Podatki za leto 2025 niso najdeni. Dostopna leta: {available_years}"
                }
            
            # Organizacija podatkov po regijah (občine + katastrske)
            regije_data = {}
            
            for row in rows:
                regija_name = row.ime_regije
                tip_posla = row.tip_posla
                vrsta_nep = row.vrsta_nepremicnine
                tip_regije_oznaka = row.tip_regije_oznaka
                stevilo = row.skupaj_poslov or 0
                
                # Inicializiraj regijo če še ne obstaja
                if regija_name not in regije_data:
                    regije_data[regija_name] = {
                        "name": regija_name,
                        "tip_regije": tip_regije_oznaka,  # označimo ali je občina ali kat_občina
                        "prodaja": {
                            "stanovanje": 0,
                            "hisa": 0,
                            "skupaj": 0
                        },
                        "najem": {
                            "stanovanje": 0,
                            "hisa": 0,
                            "skupaj": 0
                        },
                        "skupaj_vsi_posli": 0
                    }
                
                # Preveri ali so ključi veljavni
                if tip_posla in regije_data[regija_name] and vrsta_nep in regije_data[regija_name][tip_posla]:
                    # Dodaj podatke
                    regije_data[regija_name][tip_posla][vrsta_nep] = stevilo
                    regije_data[regija_name][tip_posla]["skupaj"] += stevilo
                    regije_data[regija_name]["skupaj_vsi_posli"] += stevilo
                else:
                    logger.warning(f"Neočakovan tip_posla: {tip_posla} ali vrsta_nepremicnine: {vrsta_nep}")
            
            # Ločimo podatke po tipu regije za boljši pregled
            obcine_data = {k: v for k, v in regije_data.items() if v["tip_regije"] == "obcina"}
            katastrske_data = {k: v for k, v in regije_data.items() if v["tip_regije"] == "kat_obcina"}
            
            logger.info(f"Successfully processed data for {len(obcine_data)} občin and {len(katastrske_data)} katastrskih občin")
            
            return {
                "status": "success",
                "leto": 2025,
                "vkljucene_katastrske": vkljuci_katastrske,
                "obcine_posli": obcine_data,
                "katastrske_obcine_posli": katastrske_data if vkljuci_katastrske else {},
                "skupaj_regij": len(regije_data)
            }
    
    except Exception as e:
        logger.error(f"Napaka pri pridobivanju poslov za vse regije 2025: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return {
            "status": "error", 
            "message": f"Database error: {str(e)} (Type: {type(e).__name__})"
        }


    # POMOŽNE METODE
    
    def _refresh_materialized_views(self):
        """Posodobi materialized views."""
        with self.engine.connect() as conn:
            trans = conn.begin()
            try:
                logger.info("Posodabljam materialized views...")
                
                sales_mv_sql = get_sql_query('stats/create_mv_prodajne_stats.sql')
                conn.execute(text(sales_mv_sql))
                
                rental_mv_sql = get_sql_query('stats/create_mv_najemne_stats.sql')
                conn.execute(text(rental_mv_sql))
                
                trans.commit()
                logger.info("Materialized views uspešno posodobljeni")
                
            except Exception as e:
                trans.rollback()
                raise

    def _clear_cache(self):
        """Počisti celoten cache."""
        with self.engine.connect() as conn:
            trans = conn.begin()
            try:
                conn.execute(text("TRUNCATE TABLE stats.statistike_cache"))
                logger.info("Počiščen celoten cache")
                
                trans.commit()
                
            except Exception as e:
                trans.rollback()
                raise

    def _populate_all_cache(self):
        """Polni cache z vsemi statistikami za vse regije."""
        with self.engine.connect() as conn:
            trans = conn.begin()
            try:
                logger.info("Polnim cache z vsemi statistikami...")
                
                sales_sql = get_sql_query('stats/populate_statistike_cache.sql')
                result = conn.execute(text(sales_sql))
                logger.info(f"Vstavljena statistika: {result.rowcount} zapisov")
                
                trans.commit()
                logger.info("Vsi cache podatki uspešno naloženi")
                
            except Exception as e:
                trans.rollback()
                raise