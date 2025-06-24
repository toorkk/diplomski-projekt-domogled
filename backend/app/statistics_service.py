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
            self._create_materialized_views()
            
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
        
                print(f"DEBUG: Najdenih {len(rows)} zapisov za regijo '{regija}', tip_regije '{tip_regije}'")


                if not rows:
                    return {"status": "error", "message": f"Statistike za regijo '{regija}' niso najdene"}
                
                # Organiziraj podatke po strukturah
                statistike = {
                    "prodaja": {
                        "stanovanje": {"letno": [], "zadnjih12m": None},
                        "hisa": {"letno": [], "zadnjih12m": None}
                    },
                    "najem": {
                        "stanovanje": {"letno": [], "zadnjih12m": None},
                        "hisa": {"letno": [], "zadnjih12m": None}
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
                    else:  # zadnjih12m
                        statistike[tip_trans][vrsta_nep]["zadnjih12m"] = podatek
                    
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
                  AND tip_obdobja = 'zadnjih12m'
                ORDER BY tip_posla, vrsta_nepremicnine
                """
                
                result = conn.execute(text(query), {"tip_regije": tip_regije, "regija": regija})
                rows = result.fetchall()
                
                if not rows:
                    return {"status": "error", "message": f"Splošne statistike za regijo '{regija}' niso najdene"}
                
                splosne = {
                    "regija": regija,
                    "tip_regije": tip_regije,
                    "obdobje": "zadnjih12m",
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
        Pridobi število poslov za leto 2025 za VSE občine + VSE katastrske občine
        Frontend bo filtriral katere se prikažejo
        """
        try:
            print(f"DEBUG: get_all_obcine_posli_2025 called with vkljuci_katastrske={vkljuci_katastrske}")
            
            with self.engine.connect() as conn:
                # NAJPREJ PREVERI KAKŠNE tip_regije VREDNOSTI OBSTAJAJO
                print("DEBUG: Checking what tip_regije values exist...")
                tip_regije_query = "SELECT DISTINCT tip_regije FROM stats.statistike_cache"
                tip_regije_result = conn.execute(text(tip_regije_query))
                tip_regije_values = [row[0] for row in tip_regije_result.fetchall()]
                print(f"DEBUG: Available tip_regije values: {tip_regije_values}")
                
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
                
                print("DEBUG: Executing občine query...")
                result_obcine = conn.execute(text(query_obcine), {"leto": 2025})
                rows_obcine = result_obcine.fetchall()
                print(f"DEBUG: Found {len(rows_obcine)} rows for občine")
                
                # Organizacija podatkov po občinah
                obcine_data = {}
                
                for row in rows_obcine:
                    obcina_name = row.ime_regije
                    tip_posla = row.tip_posla
                    vrsta_nep = row.vrsta_nepremicnine
                    stevilo = row.skupaj_poslov or 0
                    
                    if obcina_name not in obcine_data:
                        obcine_data[obcina_name] = {
                            "name": obcina_name,
                            "prodaja": {"stanovanje": 0, "hisa": 0, "skupaj": 0},
                            "najem": {"stanovanje": 0, "hisa": 0, "skupaj": 0},
                            "skupaj_vsi_posli": 0
                        }
                    
                    if tip_posla in obcine_data[obcina_name] and vrsta_nep in obcine_data[obcina_name][tip_posla]:
                        obcine_data[obcina_name][tip_posla][vrsta_nep] = stevilo
                        obcine_data[obcina_name][tip_posla]["skupaj"] += stevilo
                        obcine_data[obcina_name]["skupaj_vsi_posli"] += stevilo
                    else:
                        print(f"DEBUG: Unexpected tip_posla: {tip_posla} or vrsta_nepremicnine: {vrsta_nep}")

                print(f"DEBUG: Successfully processed data for {len(obcine_data)} občin")
                
                # Inicializiraj result
                result = {
                    "status": "success",
                    "leto": 2025,
                    "vkljucene_katastrske": vkljuci_katastrske,
                    "obcine_posli": obcine_data,
                    "katastrske_obcine_posli": {},
                    "skupaj_regij": len(obcine_data)
                }
                
                # Dodaj VSE katastrske občine če je zahtevano (brez filtriranja)
                if vkljuci_katastrske:
                    print("DEBUG: Processing VSE katastrske občine...")
                    
                    # POSODOBLJEN QUERY - pridobi VSE katastrske občine (brez ljubljana/maribor filtra)
                    query_katastrske = """
                    SELECT 
                        ime_regije,
                        tip_posla,
                        vrsta_nepremicnine,
                        'katastrska_obcina' as tip_regije_oznaka,
                        SUM(stevilo_poslov) as skupaj_poslov
                    FROM stats.statistike_cache 
                    WHERE leto = :leto
                        AND tip_regije = 'katastrska_obcina'
                    GROUP BY ime_regije, tip_posla, vrsta_nepremicnine
                    ORDER BY ime_regije, tip_posla, vrsta_nepremicnine
                    """
                    
                    try:
                        result_katastrske = conn.execute(text(query_katastrske), {"leto": 2025})
                        rows_katastrske = result_katastrske.fetchall()
                        print(f"DEBUG: Found {len(rows_katastrske)} rows for VSE katastrske občine")
                        
                        # Če ni podatkov za 2025, preveri katera leta so na voljo
                        if len(rows_katastrske) == 0:
                            print("DEBUG: No katastrske data for 2025, checking available years...")
                            available_years_query = """
                            SELECT DISTINCT leto, COUNT(*) as count
                            FROM stats.statistike_cache 
                            WHERE tip_regije = 'katastrska_obcina'
                            GROUP BY leto
                            ORDER BY leto DESC
                            """
                            years_result = conn.execute(text(available_years_query))
                            available_years = [(row.leto, row.count) for row in years_result.fetchall()]
                            print(f"DEBUG: Available years for katastrske: {available_years}")
                            
                            # Preveri vzorec imen katastrskih občin
                            sample_names_query = """
                            SELECT DISTINCT ime_regije 
                            FROM stats.statistike_cache 
                            WHERE tip_regije = 'katastrska_obcina'
                            ORDER BY ime_regije
                            LIMIT 20
                            """
                            names_result = conn.execute(text(sample_names_query))
                            sample_names = [row[0] for row in names_result.fetchall()]
                            print(f"DEBUG: Sample katastrske names: {sample_names}")
                        
                        katastrske_data = {}
                        
                        for row in rows_katastrske:
                            kataster_name = row.ime_regije
                            tip_posla = row.tip_posla
                            vrsta_nep = row.vrsta_nepremicnine
                            stevilo = row.skupaj_poslov or 0
                            
                            if kataster_name not in katastrske_data:
                                katastrske_data[kataster_name] = {
                                    "name": kataster_name,
                                    "prodaja": {"stanovanje": 0, "hisa": 0, "skupaj": 0},
                                    "najem": {"stanovanje": 0, "hisa": 0, "skupaj": 0},
                                    "skupaj_vsi_posli": 0
                                }
                            
                            if tip_posla in katastrske_data[kataster_name] and vrsta_nep in katastrske_data[kataster_name][tip_posla]:
                                katastrske_data[kataster_name][tip_posla][vrsta_nep] = stevilo
                                katastrske_data[kataster_name][tip_posla]["skupaj"] += stevilo
                                katastrske_data[kataster_name]["skupaj_vsi_posli"] += stevilo
                            else:
                                print(f"DEBUG: Unexpected katastrski tip_posla: {tip_posla} or vrsta_nepremicnine: {vrsta_nep}")

                        result["katastrske_obcine_posli"] = katastrske_data
                        result["skupaj_regij"] = len(obcine_data) + len(katastrske_data)
                        
                        print(f"DEBUG: Successfully processed {len(katastrske_data)} katastrskih občin")
                        print(f"DEBUG: Sample katastrske names: {list(katastrske_data.keys())[:10]}")
                        
                        # Preveri koliko Ljubljana/Maribor katastrov imamo
                        lj_mb_count = len([name for name in katastrske_data.keys() 
                                         if 'ljubljana' in name.lower() or 'maribor' in name.lower()])
                        print(f"DEBUG: Found {lj_mb_count} Ljubljana/Maribor katastrov od {len(katastrske_data)} skupno")
                        
                    except Exception as e:
                        print(f"DEBUG: Error processing katastrske občine: {str(e)}")
                        import traceback
                        print(f"DEBUG: Traceback: {traceback.format_exc()}")
                        # Nadaljuj brez katastrskih občin
                        pass
                
                return result
            
        except Exception as e:
            print(f"DEBUG: Error in get_all_obcine_posli_2025: {str(e)}")
            import traceback
            print(f"DEBUG: Traceback: {traceback.format_exc()}")
            return {
                "status": "error", 
                "message": f"Database error: {str(e)} (Type: {type(e).__name__})"
            }

    # POMOŽNE METODE
    
    def _create_materialized_views(self):
        """Ustvari materialized views."""
        with self.engine.connect() as conn:
            trans = conn.begin()
            try:
                logger.info("Posodabljam materialized views...")
                
                sales_mv_sql = get_sql_query('stats/create_mv_prodajne_stats.sql')
                conn.execute(text(sales_mv_sql))
                
                rental_mv_sql = get_sql_query('stats/create_mv_najemne_stats.sql')
                conn.execute(text(rental_mv_sql))

                sales_mv_sql_12m = get_sql_query('stats/create_mv_prodajne_stats_12m.sql')
                conn.execute(text(sales_mv_sql_12m))
                
                rental_mv_sql_12m = get_sql_query('stats/create_mv_najemne_stats_12m.sql')
                conn.execute(text(rental_mv_sql_12m))
                
                trans.commit()
                logger.info("Materialized views uspešno ustvarjeni")
                
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
                result_letno = conn.execute(text(sales_sql))

                sales_sql_12m = get_sql_query('stats/populate_statistike_cache_12m.sql')
                result_12m = conn.execute(text(sales_sql_12m))

                logger.info(f"Vstavljena statistika: {result_letno.rowcount} letnih zapisov, {result_12m.rowcount} zadnjih 12 mesecev zapisov")
                
                trans.commit()
                logger.info("Vsi cache podatki uspešno naloženi")
                
            except Exception as e:
                trans.rollback()
                raise