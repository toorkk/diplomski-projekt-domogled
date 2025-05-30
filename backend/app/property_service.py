from sqlalchemy import func
from sqlalchemy.orm import Session
from geoalchemy2.functions import ST_SetSRID, ST_MakeEnvelope, ST_Intersects, ST_AsGeoJSON, ST_X, ST_Y
from difflib import SequenceMatcher

from .models import EnergetskaIzkaznica

from .clustering_utils import calculate_cluster_resolution, get_deduplicated_property_model, get_del_stave_model, get_posel_model, serialize_list_to_json


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


class PropertyService:

    @staticmethod
    def get_municipality_all_properties(sifko: int = None, municipality: str = None, db: Session = None, data_source: str = "np"):
        """
        Pridobi VSE nepremičnine v določeni občini (ignoriraj bbox)
        Uporabi samo building clustering po stavbah
        """
        DeduplicatedModel = get_deduplicated_property_model(data_source)
        
        # Filter samo po občini/sifko, brez bbox-a
        filters = []
        matched_municipality = None
        
        if sifko:
            filters.append(DeduplicatedModel.sifra_ko == sifko)
            print(f"Loading ALL properties for sifko: {sifko}")
            
        elif municipality:
            # Uporabi string similarity za municipality
            all_municipalities = db.query(DeduplicatedModel.obcina).distinct().all()
            available_municipalities = [m[0] for m in all_municipalities if m[0]]
            
            matched_municipality = find_best_municipality_match(municipality, available_municipalities)
            
            if matched_municipality:
                filters.append(DeduplicatedModel.obcina == matched_municipality)
                print(f"Loading ALL properties for municipality: {matched_municipality}")
            else:
                print(f"No matching municipality found for '{municipality}'")
                # Vrni prazen rezultat
                return {"type": "FeatureCollection", "features": []}
        
        if not filters:
            # Ni nobenega filtra, vrni prazen rezultat
            return {"type": "FeatureCollection", "features": []}
        
        # Building clustering - grupiraj po stavbah znotraj občine
        cluster_query = db.query(
            func.count(DeduplicatedModel.del_stavbe_id).label('point_count'),
            func.avg(ST_X(DeduplicatedModel.coordinates)).label('avg_lng'),
            func.avg(ST_Y(DeduplicatedModel.coordinates)).label('avg_lat'),
            DeduplicatedModel.obcina,
            DeduplicatedModel.sifra_ko,
            DeduplicatedModel.stevilka_stavbe,
            func.array_agg(DeduplicatedModel.del_stavbe_id).label('deduplicated_ids')
        ).filter(
            *filters
        ).group_by(
            DeduplicatedModel.obcina,
            DeduplicatedModel.sifra_ko,
            DeduplicatedModel.stevilka_stavbe
        ).all()
        
        print(f"Found {len(cluster_query)} building clusters in municipality")
        
        features = []
        for row in cluster_query:
            if row.point_count == 1:
                # Single point - vrni kot individualno dedupliciran del_stavbe
                feature = PropertyService._get_individual_deduplicated_property_feature(
                    db, DeduplicatedModel, row.deduplicated_ids[0], data_source
                )
                if feature:
                    features.append(feature)
            else:
                # Multi-point cluster
                feature = {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [float(row.avg_lng), float(row.avg_lat)]
                    },
                    "properties": {
                        "type": "cluster",
                        "cluster_type": "building",
                        "point_count": row.point_count,
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
    def get_building_clustered_properties(west: float, south: float, east: float, north: float, db: Session, data_source: str = "np", municipality: str = None, sifko: int = None):
        """
        Pridobi deduplicirane nepremičnine združene po: občina + sifra_ko + stevilka_stavbe (naredi cluster za vsako stavbo znotraj občine)
        Uporabljeno ko si zoomed in blizu
        """
        DeduplicatedModel = get_deduplicated_property_model(data_source)
        bbox_geom = ST_SetSRID(ST_MakeEnvelope(west, south, east, north), 4326)
        
        # Osnovni filter
        filters = [ST_Intersects(DeduplicatedModel.coordinates, bbox_geom)]
        
        # Debug: Najprej preveri brez municipality/sifko filtra
        total_count = db.query(func.count(DeduplicatedModel.del_stavbe_id)).filter(
            ST_Intersects(DeduplicatedModel.coordinates, bbox_geom)
        ).scalar()
        print(f"Total properties in bbox (no filters): {total_count}")
        
        # PRIORITETA: SIFKO filter pred municipality filter
        matched_municipality = None
        if sifko:
            filters.append(DeduplicatedModel.sifra_ko == sifko)
            
            # Debug: Preveri koliko je s sifko filtrom
            sifko_count = db.query(func.count(DeduplicatedModel.del_stavbe_id)).filter(*filters).scalar()
            print(f"Properties with sifko '{sifko}': {sifko_count}")
            
        elif municipality:
            # Samo če sifko ni podan, uporabi municipality filter
            # Pridobi vsa imena občin v bbox-u
            unique_municipalities = db.query(DeduplicatedModel.obcina).filter(
                ST_Intersects(DeduplicatedModel.coordinates, bbox_geom)
            ).distinct().all()
            available_municipalities = [m[0] for m in unique_municipalities if m[0]]
            
            print(f"Available municipalities in bbox: {available_municipalities}")
            print(f"Looking for municipality: '{municipality}'")
            
            # Najdi najbolje ujemajoče se ime občine
            matched_municipality = find_best_municipality_match(municipality, available_municipalities)
            
            if matched_municipality:
                filters.append(DeduplicatedModel.obcina == matched_municipality)
                
                # Debug: Preveri koliko je z municipality filtrom
                municipality_count = db.query(func.count(DeduplicatedModel.del_stavbe_id)).filter(*filters).scalar()
                print(f"Properties with matched municipality '{matched_municipality}': {municipality_count}")
            else:
                print(f"No matching municipality found for '{municipality}'")
        
        cluster_query = db.query(
            func.count(DeduplicatedModel.del_stavbe_id).label('point_count'),
            func.avg(ST_X(DeduplicatedModel.coordinates)).label('avg_lng'),
            func.avg(ST_Y(DeduplicatedModel.coordinates)).label('avg_lat'),
            DeduplicatedModel.obcina,  # Dodano za clustering po občinah
            DeduplicatedModel.sifra_ko,
            DeduplicatedModel.stevilka_stavbe,
            func.array_agg(DeduplicatedModel.del_stavbe_id).label('deduplicated_ids')
        ).filter(
            *filters  # Uporabi dynamic filters
        ).group_by(
            DeduplicatedModel.obcina,  # Dodano za clustering po občinah
            DeduplicatedModel.sifra_ko,
            DeduplicatedModel.stevilka_stavbe
        ).all()
        
        features = []
        for row in cluster_query:
            if row.point_count == 1:
                # Single point - vrni kot individualno dedupliciran del_stavbe (še vedno predstavlja eno stavbo)
                feature = PropertyService._get_individual_deduplicated_property_feature(
                    db, DeduplicatedModel, row.deduplicated_ids[0], data_source
                )
                if feature:
                    features.append(feature)
            else:
                # Multi-point cluster
                feature = {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [float(row.avg_lng), float(row.avg_lat)]
                    },
                    "properties": {
                        "type": "cluster",
                        "cluster_type": "building",
                        "point_count": row.point_count,
                        "cluster_id": f"b_{matched_municipality or row.obcina}_{row.sifra_ko}_{row.stevilka_stavbe}",  # Uporabi matched_municipality
                        "obcina": matched_municipality or row.obcina,  # Uporabi matched_municipality
                        "sifra_ko": row.sifra_ko,
                        "stevilka_stavbe": row.stevilka_stavbe,
                        "data_source": data_source,
                        "deduplicated_ids": row.deduplicated_ids  # vsi deduplicirani id-ji za ta cluster
                    }
                }
                features.append(feature)
        
        return {
            "type": "FeatureCollection",
            "features": features
        }

    @staticmethod
    def get_distance_clustered_properties(west: float, south: float, east: float, north: float, zoom: float, db: Session, data_source: str = "np", municipality: str = None, sifko: int = None):
        """
        Pridobi deduplicirane nepremičnine združene po: občina + razdalji med sabo (clustering znotraj posamezne občine)
        Uporabljeno ko si zoomed srednje
        """
        DeduplicatedModel = get_deduplicated_property_model(data_source)
        resolution = calculate_cluster_resolution(zoom)
        bbox_geom = ST_SetSRID(ST_MakeEnvelope(west, south, east, north), 4326)
        
        # Osnovni filter
        filters = [ST_Intersects(DeduplicatedModel.coordinates, bbox_geom)]
        
        # PRIORITETA: SIFKO filter pred municipality filter
        matched_municipality = None
        if sifko:
            filters.append(DeduplicatedModel.sifra_ko == sifko)
            print(f"Distance clustering: Using sifko filter '{sifko}'")
            
        elif municipality:
            # Samo če sifko ni podan, uporabi municipality filter
            # Pridobi vsa imena občin v bbox-u
            unique_municipalities = db.query(DeduplicatedModel.obcina).filter(
                ST_Intersects(DeduplicatedModel.coordinates, bbox_geom)
            ).distinct().all()
            available_municipalities = [m[0] for m in unique_municipalities if m[0]]
            
            # Najdi najbolje ujemajoče se ime občine
            matched_municipality = find_best_municipality_match(municipality, available_municipalities)
            
            if matched_municipality:
                filters.append(DeduplicatedModel.obcina == matched_municipality)
                print(f"Distance clustering: Using matched municipality '{matched_municipality}' for '{municipality}'")
            else:
                print(f"Distance clustering: No matching municipality found for '{municipality}'")
        
        cluster_query = db.query(
            func.count(DeduplicatedModel.del_stavbe_id).label('point_count'),
            func.avg(ST_X(DeduplicatedModel.coordinates)).label('avg_lng'),
            func.avg(ST_Y(DeduplicatedModel.coordinates)).label('avg_lat'),
            DeduplicatedModel.obcina,  # Dodano za clustering po občinah
            func.floor(ST_X(DeduplicatedModel.coordinates) / resolution).label('cluster_x'),
            func.floor(ST_Y(DeduplicatedModel.coordinates) / resolution).label('cluster_y'),
            func.array_agg(DeduplicatedModel.del_stavbe_id).label('deduplicated_ids')
        ).filter(
            *filters  # Uporabi dynamic filters
        ).group_by(
            DeduplicatedModel.obcina,  # Dodano za clustering po občinah
            func.floor(ST_X(DeduplicatedModel.coordinates) / resolution),
            func.floor(ST_Y(DeduplicatedModel.coordinates) / resolution)
        ).all()
        
        features = []
        for row in cluster_query:
            if row.point_count == 1:
                # Single point - vrni kot individualno dedupliciran del_stavbe (še vedno predstavlja eno stavbo)
                feature = PropertyService._get_individual_deduplicated_property_feature(
                    db, DeduplicatedModel, row.deduplicated_ids[0], data_source
                )
                if feature:
                    features.append(feature)
            else:
                # Multi-point cluster
                feature = {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [float(row.avg_lng), float(row.avg_lat)]
                    },
                    "properties": {
                        "type": "cluster",
                        "cluster_type": "distance",
                        "point_count": row.point_count,
                        "cluster_id": f"d_{matched_municipality or row.obcina}_{row.cluster_x}_{row.cluster_y}",  # Uporabi matched_municipality
                        "obcina": matched_municipality or row.obcina,  # Uporabi matched_municipality
                        "data_source": data_source,
                        "deduplicated_ids": row.deduplicated_ids  # vsi deduplicirani id-ji za ta cluster
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
        if data_source.lower() == "np":
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
                
                "povrsina": float(dedup_property[0].povrsina) if dedup_property[0].povrsina else None,
                "povrsina_uporabna": float(dedup_property[0].povrsina_uporabna) if dedup_property[0].povrsina_uporabna else None,
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
    

    @staticmethod
    def get_building_cluster_properties(obcina: str, sifra_ko: int, stevilka_stavbe: int, db: Session, data_source: str = "np"):
        """
        Pridobi vse deduplicirane nepremičnine v določeni stavbi v določeni občini
        """
        DeduplicatedModel = get_deduplicated_property_model(data_source)
        
        # Poiščemo vse deduplicirane property_ids v tej stavbi v tej občini
        deduplicated_properties = db.query(DeduplicatedModel).filter(
            DeduplicatedModel.obcina == obcina,
            DeduplicatedModel.sifra_ko == sifra_ko,
            DeduplicatedModel.stevilka_stavbe == stevilka_stavbe
        ).all()
        
        print(f"Found {len(deduplicated_properties)} deduplicated properties in building")  # Debug
        
        features = []
        skipped_properties = 0
        
        for dedup_prop in deduplicated_properties:
            try:
                feature = PropertyService._get_individual_deduplicated_property_feature(
                    db, DeduplicatedModel, dedup_prop.del_stavbe_id, data_source
                )
                if feature:
                    features.append(feature)
                else:
                    print(f"Deduplicated property ID {dedup_prop.del_stavbe_id} returned None - skipping")
                    skipped_properties += 1
            except Exception as e:
                print(f"Error processing deduplicated property ID {dedup_prop.del_stavbe_id}: {str(e)}")
                skipped_properties += 1
                continue
        
        if skipped_properties > 0:
            print(f"Warning: Skipped {skipped_properties} deduplicated properties")
        
        return {
            "type": "FeatureCollection", 
            "features": features,
            "cluster_info": {
                "cluster_id": f"b_{obcina}_{sifra_ko}_{stevilka_stavbe}",
                "total_properties": len(features),
                "skipped_properties": skipped_properties,
                "obcina": obcina,
                "sifra_ko": sifra_ko,
                "stevilka_stavbe": stevilka_stavbe
            }
        }
    
    @staticmethod
    def get_property_details(deduplicated_id: int, data_source: str, db: Session):
        """
        Pridobi podrobnosti za določeno deduplicirano nepremičnino, ko kliknemo podrobnosti v pop-up.
        Vrne vse povezane posel, del_stavbe, energetska_izkaznica.
        """
        DeduplicatedModel = get_deduplicated_property_model(data_source)
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
                
                "sifra_ko": representative_del_stavbe.sifra_ko,
                "stevilka_stavbe": representative_del_stavbe.stevilka_stavbe,
                "stevilka_dela_stavbe": representative_del_stavbe.stevilka_dela_stavbe,
                "dejanska_raba": representative_del_stavbe.dejanska_raba,
                "obcina": representative_del_stavbe.obcina,
                "naselje": representative_del_stavbe.naselje,
                "ulica": representative_del_stavbe.ulica,
                "hisna_stevilka": representative_del_stavbe.hisna_stevilka,
                "dodatek_hs": representative_del_stavbe.dodatek_hs,
                "stev_stanovanja": representative_del_stavbe.stev_stanovanja,
                "vrsta": representative_del_stavbe.vrsta,
                "povrsina": float(representative_del_stavbe.povrsina) if representative_del_stavbe.povrsina else None,
                "data_source": data_source,
                
                "stevilo_poslov": len(dedup_del_stavbe[0].povezani_posel_ids),
                "ima_vec_poslov": len(dedup_del_stavbe[0].povezani_posel_ids) > 1,
                
                "povezani_deli_stavb": serialize_list_to_json(vsi_povezani_deli_stavb),
                "povezani_posli": serialize_list_to_json(vsi_posli),
                "energetske_izkaznice": serialize_list_to_json(energetske_izkaznice)
            }
        }