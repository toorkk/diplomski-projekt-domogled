from sqlalchemy import func
from sqlalchemy.orm import Session
from geoalchemy2.functions import ST_SetSRID, ST_MakeEnvelope, ST_Intersects, ST_X, ST_Y
from difflib import SequenceMatcher

from .models import EnergetskaIzkaznica

from .clustering_utils import calculate_cluster_resolution, get_deduplicated_del_stavbe_model, get_del_stave_model, get_posel_model, serialize_list_to_json, apply_del_stavbe_filters, serialize_to_json


class DelStavbeService:


########################
#
#   DISTANCE CLUSTERING
#
########################


    @staticmethod
    def get_distance_clustered_del_stavbe(west: float, south: float, east: float, north: float, zoom: float, db: Session, data_source: str = "np", filters: dict = None):
        """
        Pridobi deduplicirane nepremičnine združene po: občina + razdalji med sabo (clustering znotraj posamezne občine)
        Uporabljeno ko si zoomed out
        """
        DeduplicatedModel = get_deduplicated_del_stavbe_model(data_source)
        resolution = calculate_cluster_resolution(zoom)
        bbox_geom = ST_SetSRID(ST_MakeEnvelope(west, south, east, north), 4326)
        
        # SQL query - vse del stavbe v bbox-u
        base_query = db.query(
            DeduplicatedModel.del_stavbe_id,
            DeduplicatedModel.obcina,
            DeduplicatedModel.sifra_ko,
            DeduplicatedModel.stevilka_stavbe,
            DeduplicatedModel.stevilka_dela_stavbe,
            ST_X(DeduplicatedModel.coordinates).label('lng'),
            ST_Y(DeduplicatedModel.coordinates).label('lat'),
            DeduplicatedModel.dejanska_raba,
        ).filter(ST_Intersects(DeduplicatedModel.coordinates, bbox_geom))
        
        base_query = apply_del_stavbe_filters(base_query, DeduplicatedModel, filters, data_source)
        
        # Dodaj data_source specifične podatke
        if data_source.lower() == "np":
            base_query = base_query.add_columns(
                DeduplicatedModel.opremljenost,
                DeduplicatedModel.zadnja_najemnina,
                DeduplicatedModel.zadnje_vkljuceno_stroski,
                DeduplicatedModel.zadnje_vkljuceno_ddv,
                DeduplicatedModel.zadnja_stopnja_ddv
            )
        else:  # kpp
            base_query = base_query.add_columns(
                DeduplicatedModel.stevilo_sob,
                DeduplicatedModel.zadnja_cena,
                DeduplicatedModel.zadnje_vkljuceno_ddv,
                DeduplicatedModel.zadnja_stopnja_ddv
            )
        
        all_del_stavbe = base_query.all()

        
        # 2. Python clustering po distance grid
        distance_groups = {}
        for ds in all_del_stavbe:
            # Distance clustering - grid coordinates
            cluster_x = int(ds.lng / resolution)
            cluster_y = int(ds.lat / resolution)
            cluster_key = f"{ds.obcina}_{cluster_x}_{cluster_y}"
            
            if cluster_key not in distance_groups:
                distance_groups[cluster_key] = []
            distance_groups[cluster_key].append(ds)
        

        # 3. Generiraj features
        features = []
        for cluster_key, del_stavbe in distance_groups.items():
            if len(del_stavbe) == 1:
                # individualni del stavbe
                ds = del_stavbe[0]

                feature = {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [ds.lng, ds.lat]
                    },
                    "properties": {
                        "type": "individual",
                        "cluster_type": "distance",
                        "obcina": ds.obcina,
                        "data_source": data_source,
                        "deduplicated_id": ds.del_stavbe_id
                    }
                }
            else:
                # distance multicluster
                avg_lng = sum(float(ds.lng) for ds in del_stavbe) / len(del_stavbe)
                avg_lat = sum(float(ds.lat) for ds in del_stavbe) / len(del_stavbe)
                
                first_ds = del_stavbe[0]
                cluster_x = int(first_ds.lng / resolution)
                cluster_y = int(first_ds.lat / resolution)
                
                feature = {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [avg_lng, avg_lat]
                    },
                    "properties": {
                        "type": "cluster",
                        "cluster_type": "distance",
                        "point_count": len(del_stavbe),
                        "cluster_id": f"d_{first_ds.obcina}_{cluster_x}_{cluster_y}",
                        "obcina": first_ds.obcina,
                        "data_source": data_source,
                        "deduplicated_ids": [ds.del_stavbe_id for ds in del_stavbe]
                    }
                }
            
            features.append(feature)
        
        return {
            "type": "FeatureCollection",
            "features": features
        }
    


#########################
#
#   BUILDING CLUSTERING
#
#########################


    @staticmethod
    def get_building_clustered_del_stavbe(west: float, south: float, east: float, north: float, db: Session, data_source: str = "np", filters: dict = None):
        """
        Pridobi deduplicirane nepremičnine združene po: občina + sifra_ko + stevilka_stavbe (naredi cluster za vsako stavbo znotraj občine)
        Uporabljeno ko si zoomed in
        """

        DeduplicatedModel = get_deduplicated_del_stavbe_model(data_source)
        bbox_geom = ST_SetSRID(ST_MakeEnvelope(west, south, east, north), 4326)

        base_query = DelStavbeService._build_del_stavbe_query(db, DeduplicatedModel, data_source)
        base_query = base_query.filter(ST_Intersects(DeduplicatedModel.coordinates, bbox_geom))
        base_query = apply_del_stavbe_filters(base_query, DeduplicatedModel, filters, data_source)
        
        all_del_stavbe = base_query.all()


        # Python clustering po stavbah
        building_groups = {}
        for ds in all_del_stavbe:
            building_key = f"{ds.obcina}_{ds.sifra_ko}_{ds.stevilka_stavbe}"
            if building_key not in building_groups:
                building_groups[building_key] = []
            building_groups[building_key].append(ds)
        

        # Generiraj features
        features = []
        for building_key, del_stavbe in building_groups.items():
            if len(del_stavbe) == 1:
                feature = DelStavbeService._create_del_stavbe_feature_json(del_stavbe[0], data_source)
            else:

                avg_lng = sum(float(p.lng) for p in del_stavbe) / len(del_stavbe)
                avg_lat = sum(float(p.lat) for p in del_stavbe) / len(del_stavbe)

                first_ds = del_stavbe[0]  # Vsi v isti stavbi imajo iste osnovne podatke
                
                feature = {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [avg_lng, avg_lat]
                    },
                    "properties": {
                        "type": "cluster",
                        "cluster_type": "building",
                        "point_count": len(del_stavbe),
                        "cluster_id": f"b_{first_ds.obcina}_{first_ds.sifra_ko}_{first_ds.stevilka_stavbe}",
                        "obcina": first_ds.obcina,
                        "sifra_ko": first_ds.sifra_ko,
                        "stevilka_stavbe": first_ds.stevilka_stavbe,
                        "data_source": data_source,
                        "deduplicated_ids": [ds.del_stavbe_id for ds in del_stavbe]
                    }
                }
            
            features.append(feature)
        
        return {
            "type": "FeatureCollection",
            "features": features
        }
    

    @staticmethod
    def get_stavba_multicluster(obcina: str, sifra_ko: int, stevilka_stavbe: int, db: Session, data_source: str = "np", filters: dict = None):
        """
        Pridobi vse deduplicirane nepremičnine v določeni stavbi (enem multiclusterju)
        """
        DeduplicatedModel = get_deduplicated_del_stavbe_model(data_source)
        
        base_query = DelStavbeService._build_del_stavbe_query(db, DeduplicatedModel, data_source)
        
        # filter da dobis tocno to stavbo
        base_query = base_query.filter(
            DeduplicatedModel.obcina == obcina,
            DeduplicatedModel.sifra_ko == sifra_ko,
            DeduplicatedModel.stevilka_stavbe == stevilka_stavbe
        )
        
        base_query = apply_del_stavbe_filters(base_query, DeduplicatedModel, filters, data_source)
        
        all_del_stavbe = base_query.all()
                

        # generiraj features
        features = []
        skipped_del_stavbe = 0
        
        for ds in all_del_stavbe:
            try:
                feature = DelStavbeService._create_del_stavbe_feature_json(ds, data_source)
                features.append(feature)
            except Exception as e:
                print(f"NAPAKA PRI DELU STAVBE Z ID {ds.del_stavbe_id}: {str(e)}")
                skipped_del_stavbe += 1
                continue
        
        if skipped_del_stavbe > 0:
            print(f"OPOZORILO: PRESKOČENIH {skipped_del_stavbe} DEDUPLICIRANIH DELOV STAVB")
        
        return {
            "type": "FeatureCollection", 
            "features": features,
            "cluster_info": {
                "cluster_id": f"b_{obcina}_{sifra_ko}_{stevilka_stavbe}",
                "total_properties": len(features),
                "skipped_properties": skipped_del_stavbe,
                "obcina": obcina,
                "sifra_ko": sifra_ko,
                "stevilka_stavbe": stevilka_stavbe
            }
        }
        

    @staticmethod
    def get_del_stavbe_details(deduplicated_id: int, data_source: str, db: Session):
        """
        Pridobi podrobnosti za določeno deduplicirano nepremičnino (ko kliknemo podrobnosti v pop-up).
        Vrne vse povezane posel, del_stavbe, energetska_izkaznica.
        """
        DeduplicatedModel = get_deduplicated_del_stavbe_model(data_source)
        DelStavbeModel = get_del_stave_model(data_source)
        PoselModel = get_posel_model(data_source)

        
        # Pridobi deduplicirani zapis nepremičnine
        dedup_del_stavbe = db.query(
            DeduplicatedModel,
            ST_X(DeduplicatedModel.coordinates).label('longitude'),
            ST_Y(DeduplicatedModel.coordinates).label('latitude')
        ).filter(
            DeduplicatedModel.del_stavbe_id == deduplicated_id
        ).first()
        
        if not dedup_del_stavbe:
            return None
        

        # Pridobi vse povezane del_stavbe zapise, povezane posle, reprezentativni (zadnji) del stavbe in energetske izkaznice
        vsi_povezani_deli_stavb = db.query(DelStavbeModel).filter(
            DelStavbeModel.del_stavbe_id.in_(dedup_del_stavbe[0].povezani_del_stavbe_ids)
        ).all()

        vsi_posli = db.query(PoselModel).filter(
            PoselModel.posel_id.in_(dedup_del_stavbe[0].povezani_posel_ids)
        ).all()
        
        representative_del_stavbe = db.query(DelStavbeModel).filter(
            DelStavbeModel.del_stavbe_id == dedup_del_stavbe[0].najnovejsi_del_stavbe_id
        ).first()

        if dedup_del_stavbe[0].energetske_izkaznice:
            energetske_izkaznice = db.query(EnergetskaIzkaznica).filter(
                EnergetskaIzkaznica.id.in_(dedup_del_stavbe[0].energetske_izkaznice)
            ).all()
        else:
            energetske_izkaznice = []


        if not representative_del_stavbe:
            return None
        
        
        return {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [
                    float(dedup_del_stavbe.longitude),
                    float(dedup_del_stavbe.latitude)
                ]
            },
            "properties": {
                "deduplicated_id": dedup_del_stavbe[0].del_stavbe_id,
                "type": "individual",
                "data_source": data_source,

                "reprezentativni_del_stavbe": serialize_to_json(representative_del_stavbe),  
                
                "stevilo_poslov": len(dedup_del_stavbe[0].povezani_posel_ids),
                "ima_vec_poslov": len(dedup_del_stavbe[0].povezani_posel_ids) > 1,
                
                "povezani_deli_stavb": serialize_list_to_json(vsi_povezani_deli_stavb),
                "povezani_posli": serialize_list_to_json(vsi_posli),
                "energetske_izkaznice": serialize_list_to_json(energetske_izkaznice)
            }
        }
    

######################
#
#   HELPER METODE
#
######################


    @staticmethod
    def _build_del_stavbe_query(db: Session, DeduplicatedModel, data_source: str):
        """
        Helper za individualni del stavbe query
        """
        base_query = db.query(
            DeduplicatedModel.del_stavbe_id,
            DeduplicatedModel.sifra_ko,
            DeduplicatedModel.stevilka_stavbe,
            DeduplicatedModel.stevilka_dela_stavbe,
            DeduplicatedModel.dejanska_raba,
            DeduplicatedModel.obcina,
            DeduplicatedModel.naselje,
            DeduplicatedModel.ulica,
            DeduplicatedModel.hisna_stevilka,
            DeduplicatedModel.dodatek_hs,
            DeduplicatedModel.stev_stanovanja,
            DeduplicatedModel.povrsina_uradna,
            DeduplicatedModel.povrsina_uporabna,
            DeduplicatedModel.leto_izgradnje_stavbe,
            DeduplicatedModel.zadnje_leto,
            DeduplicatedModel.energetske_izkaznice,
            DeduplicatedModel.energijski_razred,
            DeduplicatedModel.povezani_posel_ids,
            ST_X(DeduplicatedModel.coordinates).label('lng'),
            ST_Y(DeduplicatedModel.coordinates).label('lat')
        )
        
        # Dodaj data_source specifične podatke
        if data_source.lower() == "np":
            base_query = base_query.add_columns(
                DeduplicatedModel.opremljenost,
                DeduplicatedModel.zadnja_najemnina,
                DeduplicatedModel.zadnje_vkljuceno_stroski,
                DeduplicatedModel.zadnje_vkljuceno_ddv,
                DeduplicatedModel.zadnja_stopnja_ddv
            )
        else:  # kpp
            base_query = base_query.add_columns(
                DeduplicatedModel.stevilo_sob,
                DeduplicatedModel.zadnja_cena,
                DeduplicatedModel.zadnje_vkljuceno_ddv,
                DeduplicatedModel.zadnja_stopnja_ddv
            )
        
        return base_query



    @staticmethod
    def _create_del_stavbe_feature_json(del_stavbe, data_source: str):
        """
        Helper za kreiranje individualnih del stavbe json feature responsov
        """

        zadnji_posel_info = {}
        del_stavbe_dodatno = {}
        
        if data_source.lower() == "np":
            del_stavbe_dodatno = {
                "opremljenost": del_stavbe.opremljenost
            }
            zadnji_posel_info = {
                "zadnja_najemnina": float(del_stavbe.zadnja_najemnina) if del_stavbe.zadnja_najemnina else None,
                "zadnje_vkljuceno_stroski": del_stavbe.zadnje_vkljuceno_stroski,
                "zadnje_vkljuceno_ddv": del_stavbe.zadnje_vkljuceno_ddv,
                "zadnja_stopnja_ddv": float(del_stavbe.zadnja_stopnja_ddv) if del_stavbe.zadnja_stopnja_ddv else None,
            }
        else:  # kpp
            del_stavbe_dodatno = {
                "stevilo_sob": del_stavbe.stevilo_sob
            }
            zadnji_posel_info = {
                "zadnja_cena": float(del_stavbe.zadnja_cena) if del_stavbe.zadnja_cena else None,
                "zadnje_vkljuceno_ddv": del_stavbe.zadnje_vkljuceno_ddv,
                "zadnja_stopnja_ddv": float(del_stavbe.zadnja_stopnja_ddv) if del_stavbe.zadnja_stopnja_ddv else None,
            }
        
        stevilo_poslov = len(del_stavbe.povezani_posel_ids) if del_stavbe.povezani_posel_ids else 0
        
        return {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [float(del_stavbe.lng), float(del_stavbe.lat)]
            },
            "properties": {
                "id": del_stavbe.del_stavbe_id,
                "type": "individual",
                
                "sifra_ko": del_stavbe.sifra_ko,
                "stevilka_stavbe": del_stavbe.stevilka_stavbe,
                "stevilka_dela_stavbe": del_stavbe.stevilka_dela_stavbe,
                "dejanska_raba": del_stavbe.dejanska_raba,
                
                "obcina": del_stavbe.obcina,
                "naselje": del_stavbe.naselje,
                "ulica": del_stavbe.ulica,
                "hisna_stevilka": del_stavbe.hisna_stevilka,
                "dodatek_hs": del_stavbe.dodatek_hs,
                "stev_stanovanja": del_stavbe.stev_stanovanja,
                
                "povrsina_uradna": float(del_stavbe.povrsina_uradna) if del_stavbe.povrsina_uradna else None,
                "povrsina_uporabna": float(del_stavbe.povrsina_uporabna) if del_stavbe.povrsina_uporabna else None,
                **del_stavbe_dodatno,
                
                "leto_izgradnje_stavbe": del_stavbe.leto_izgradnje_stavbe,
                
                "stevilo_poslov": stevilo_poslov,
                "ima_vec_poslov": stevilo_poslov > 1,
                "zadnje_leto": del_stavbe.zadnje_leto,
                
                **zadnji_posel_info,
                
                "energetske_izkaznice": del_stavbe.energetske_izkaznice,
                "energijski_razred": del_stavbe.energijski_razred,
                
                "data_source": data_source
            }
        }












#######################################################
#
#   TE FUNKCIJE SE NE UPORABLJAJO VEČ AMPAK BODO MOGOČE KDAJ USEFUL V PRIHODNOSTI ČE NADALJUJEMA Z RAZVOJEM
#
#######################################################
    @staticmethod
    def get_municipality_all_del_stavb(sifko: int = None, municipality: str = None, db: Session = None, data_source: str = "np", filters: dict = None):
        """
        Pridobi VSE nepremičnine v določeni občini (ignoriraj bbox)
        Uporabi samo building clustering po stavbah
        """
        DeduplicatedModel = get_deduplicated_del_stavbe_model(data_source)
        
        base_query = db.query(
            func.count(DeduplicatedModel.del_stavbe_id).label('point_count'),
            func.avg(ST_X(DeduplicatedModel.coordinates)).label('avg_lng'),
            func.avg(ST_Y(DeduplicatedModel.coordinates)).label('avg_lat'),
            DeduplicatedModel.obcina,
            DeduplicatedModel.sifra_ko,
            DeduplicatedModel.stevilka_stavbe,
            func.array_agg(DeduplicatedModel.del_stavbe_id).label('deduplicated_ids')
        )
        
        query_filters = []
        matched_municipality = None
        
        if sifko:
            query_filters.append(DeduplicatedModel.sifra_ko == sifko)
            print(f"Loading ALL properties for sifko: {sifko}")
            
        elif municipality:
            # Uporabi string similarity za municipality
            all_municipalities = db.query(DeduplicatedModel.obcina).distinct().all()
            available_municipalities = [m[0] for m in all_municipalities if m[0]]
            
            matched_municipality = find_best_municipality_match(municipality, available_municipalities)
            
            if matched_municipality:
                query_filters.append(DeduplicatedModel.obcina == matched_municipality)
                print(f"Loading ALL properties for municipality: {matched_municipality}")
            else:
                print(f"No matching municipality found for '{municipality}'")
                # Vrni prazen rezultat
                return {"type": "FeatureCollection", "features": []}
        
        if not query_filters:
            # Ni nobenega filtra, vrni prazen rezultat
            return {"type": "FeatureCollection", "features": []}
        
        # filtri za KO in navadne obcine
        base_query = base_query.filter(*query_filters)
        
        # filtri za nepremicnine
        base_query = apply_del_stavbe_filters(base_query, DeduplicatedModel, filters, data_source)
        
        # Building clustering - grupiraj po stavbah znotraj občine
        cluster_query = base_query.group_by(
            DeduplicatedModel.obcina,
            DeduplicatedModel.sifra_ko,
            DeduplicatedModel.stevilka_stavbe
        ).all()
        
        print(f"Found {len(cluster_query)} building clusters in municipality")
        
        features = []
        for row in cluster_query:
            if row.point_count == 1:
                # Single point - vrni kot individualno dedupliciran del_stavbe
                feature = DelStavbeService._get_individual_deduplicated_property_feature(
                    db, DeduplicatedModel, row.deduplicated_ids[0], data_source
                )
                if feature:
                    features.append(feature)
            else:
                # Multicluster

                feature = {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [float(row.avg_lng), float(row.avg_lat)]
                    },
                    "properties": {
                        "type": "cluster",
                        "cluster_type": "building",
                        "point_count": 1,
                        "cluster_id": f"b_{matched_municipality or row.obcina}_{row.sifra_ko}_{row.stevilka_stavbe}",
                        "obcina": matched_municipality or row.obcina,
                        "sifra_ko": row.sifra_ko,
                        "stevilka_stavbe": row.stevilka_stavbe,
                        "data_source": data_source,
                        "deduplicated_ids": row.deduplicated_ids
                    }
                }
                features.append(feature)
        
        return {
            "type": "FeatureCollection",
            "features": features
        }
    
    
    @staticmethod
    def _get_individual_deduplicated_property_feature(db: Session, DeduplicatedModel, deduplicated_id: int, data_source: str):
        """
        Helper za pridobitev osnovnih podatkov deduplicirane nepremičnine za prikaz na zemljevidu
        (brez vseh podrobnosti - te pridobiš z get_property_details)
        """
        

        dedup_property = db.query(
            DeduplicatedModel,
            ST_X(DeduplicatedModel.coordinates).label('longitude'),
            ST_Y(DeduplicatedModel.coordinates).label('latitude')
        ).filter(
            DeduplicatedModel.del_stavbe_id == deduplicated_id,
        ).first()
        
        if not dedup_property:
            return None
        
        # Določi stevilo_poslov na podlagi podatkov v tabeli
        stevilo_poslov = len(dedup_property[0].povezani_posel_ids) if dedup_property[0].povezani_posel_ids else 0
        
        # Priprava osnovnih posel podatkov glede na data_source
        zadnji_posel_info = {}
        del_stavbe_np_dodatno = {}
        if data_source.lower() == "np":
            del_stavbe_np_dodatno = {
            }

            zadnji_posel_info = {
                "zadnja_najemnina": float(dedup_property[0].zadnja_najemnina),
                "zadnje_vkljuceno_stroski": dedup_property[0].zadnje_vkljuceno_stroski,
                "zadnje_vkljuceno_ddv": dedup_property[0].zadnje_vkljuceno_ddv,
                "zadnja_stopnja_ddv": float(dedup_property[0].zadnja_stopnja_ddv) if dedup_property[0].zadnja_stopnja_ddv else None,
           }
        else:  # kpp
            zadnji_posel_info = {
                "zadnja_cena": float(dedup_property[0].zadnja_cena),
                "zadnje_vkljuceno_ddv": dedup_property[0].zadnje_vkljuceno_ddv,
                "zadnja_stopnja_ddv": float(dedup_property[0].zadnja_stopnja_ddv) if dedup_property[0].zadnja_stopnja_ddv else None,
            }
        
        return {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [float(dedup_property.longitude), float(dedup_property.latitude)]
            },
            "properties": {
                "id": dedup_property[0].del_stavbe_id,
                "type": "individual",
                
                "sifra_ko": dedup_property[0].sifra_ko,
                "stevilka_stavbe": dedup_property[0].stevilka_stavbe,
                "stevilka_dela_stavbe": dedup_property[0].stevilka_dela_stavbe,
                "dejanska_raba": dedup_property[0].dejanska_raba,
                
                "obcina": dedup_property[0].obcina,
                "naselje": dedup_property[0].naselje,
                "ulica": dedup_property[0].ulica,
                "hisna_stevilka": dedup_property[0].hisna_stevilka,
                "dodatek_hs": dedup_property[0].dodatek_hs,
                "stev_stanovanja": dedup_property[0].stev_stanovanja,
                
                "povrsina_uradna": float(dedup_property[0].povrsina_uradna) if dedup_property[0].povrsina_uradna else None,
                "povrsina_uporabna": float(dedup_property[0].povrsina_uporabna) if dedup_property[0].povrsina_uporabna else None,
                **del_stavbe_np_dodatno,  # samo za np

                "leto_izgradnje_stavbe": dedup_property[0].leto_izgradnje_stavbe,
                
                **({"opremljenost": dedup_property[0].opremljenost} if data_source.lower() == "np" else {}),
                **({"stevilo_sob": dedup_property[0].stevilo_sob} if data_source.lower() == "kpp" else {}),
                
                "stevilo_poslov": stevilo_poslov,
                "ima_vec_poslov": stevilo_poslov > 1,
                "zadnje_leto": dedup_property[0].zadnje_leto,
                
                **zadnji_posel_info,

                "energetske_izkaznice": dedup_property[0].energetske_izkaznice,
                "energijski_razred": dedup_property[0].energijski_razred,

                "data_source": data_source
            }
        }

def get_municipality_similarity(name1: str, name2: str) -> float:
    """
    Izračuna similarity med dvema imenoma občin.
    Vrne vrednost med 0 in 1, kjer 1 pomeni popolno ujemanje.
    """
    if not name1 or not name2:
        return 0.0
    
    # Normaliziraj imena (lowercase, remove spaces)
    name1_norm = name1.lower().strip().replace(' ', '')
    name2_norm = name2.lower().strip().replace(' ', '')
    
    # Exact match
    if name1_norm == name2_norm:
        return 1.0
    
    # Sequence similarity
    return SequenceMatcher(None, name1_norm, name2_norm).ratio()


def find_best_municipality_match(target_municipality: str, available_municipalities: list, threshold: float = 0.8) -> str:
    """
    Najde najboljše ujemanje za ime občine iz seznama razpoložljivih občin.
    """
    if not target_municipality or not available_municipalities:
        return None
    
    best_match = None
    best_score = 0.0
    
    for municipality in available_municipalities:
        if municipality:
            score = get_municipality_similarity(target_municipality, municipality)
            if score > best_score and score >= threshold:
                best_score = score
                best_match = municipality
    
    print(f"Municipality matching: '{target_municipality}' -> '{best_match}' (score: {best_score:.3f})")
    return best_match