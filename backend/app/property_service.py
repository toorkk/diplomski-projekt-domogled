from sqlalchemy import func
from sqlalchemy.orm import Session
from geoalchemy2.functions import ST_SetSRID, ST_MakeEnvelope, ST_Intersects, ST_AsGeoJSON, ST_X, ST_Y

from .models import EnergetskaIzkaznica

from .clustering_utils import calculate_cluster_resolution, get_deduplicated_property_model, get_del_stave_model, get_posel_model, serialize_list_to_json


class PropertyService:

    @staticmethod
    def get_building_clustered_properties(west: float, south: float, east: float, north: float, db: Session, data_source: str = "np"):
        """
        Pridobi deduplicirane nepremičnine združene po: sifra_ko, stevilka_stavbe (naredi cluster za vsako stavbo)
        Uporabljeno ko si zoomed in blizu
        """
        DeduplicatedModel = get_deduplicated_property_model(data_source)
        bbox_geom = ST_SetSRID(ST_MakeEnvelope(west, south, east, north), 4326)
        
        cluster_query = db.query(
            func.count(DeduplicatedModel.del_stavbe_id).label('point_count'),
            func.avg(ST_X(DeduplicatedModel.coordinates)).label('avg_lng'),
            func.avg(ST_Y(DeduplicatedModel.coordinates)).label('avg_lat'),
            DeduplicatedModel.sifra_ko,
            DeduplicatedModel.stevilka_stavbe,
            func.array_agg(DeduplicatedModel.del_stavbe_id).label('deduplicated_ids')
        ).filter(
            ST_Intersects(DeduplicatedModel.coordinates, bbox_geom),
        ).group_by(
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
                        "cluster_id": f"b_{row.sifra_ko}_{row.stevilka_stavbe}",
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
    def get_distance_clustered_properties(west: float, south: float, east: float, north: float, zoom: float, db: Session, data_source: str = "np"):
        """
        Pridobi deduplicirane nepremičnine združene po: razdalji med sabo
        Uporabljeno ko si zoomed srednje
        """
        DeduplicatedModel = get_deduplicated_property_model(data_source)
        resolution = calculate_cluster_resolution(zoom)
        bbox_geom = ST_SetSRID(ST_MakeEnvelope(west, south, east, north), 4326)
        
        cluster_query = db.query(
            func.count(DeduplicatedModel.del_stavbe_id).label('point_count'),
            func.avg(ST_X(DeduplicatedModel.coordinates)).label('avg_lng'),
            func.avg(ST_Y(DeduplicatedModel.coordinates)).label('avg_lat'),
            func.floor(ST_X(DeduplicatedModel.coordinates) / resolution).label('cluster_x'),
            func.floor(ST_Y(DeduplicatedModel.coordinates) / resolution).label('cluster_y'),
            func.array_agg(DeduplicatedModel.del_stavbe_id).label('deduplicated_ids')
        ).filter(
            ST_Intersects(DeduplicatedModel.coordinates, bbox_geom)
        ).group_by(
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
                        "cluster_id": f"d_{row.cluster_x}_{row.cluster_y}",
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
    def get_building_cluster_properties(sifra_ko: int, stevilka_stavbe: int, db: Session, data_source: str = "np"):
        """
        Pridobi vse deduplicirane nepremičnine v določeni stavbi
        """
        DeduplicatedModel = get_deduplicated_property_model(data_source)
        
        # Poiščemo vse deduplicirane property_ids v tej stavbi
        deduplicated_properties = db.query(DeduplicatedModel).filter(
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
                "cluster_id": f"b_{sifra_ko}_{stevilka_stavbe}",
                "total_properties": len(features),
                "skipped_properties": skipped_properties,
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