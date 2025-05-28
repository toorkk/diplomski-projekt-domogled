import json
from sqlalchemy import func
from sqlalchemy.orm import Session
from geoalchemy2.functions import ST_SetSRID, ST_MakeEnvelope, ST_Intersects, ST_AsGeoJSON, ST_X, ST_Y

from .clustering_utils import calculate_cluster_resolution, get_deduplicated_property_model, get_property_model
from .models import NpPosel, KppPosel


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
        
        # Priprava osnovnih contract podatkov glede na data_source
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
        NOVA METODA: Pridobi popolne podrobnosti za določeno deduplicirano nepremičnino, ko jo kliknemo na zemljevidu.
        Vrne VSE povezane pogodbe in del_stavbe zapise.
        """
        DeduplicatedModel = get_deduplicated_property_model(data_source)
        PropertyModel = get_property_model(data_source)
        
        # Pridobi deduplicirani zapis nepremičnine
        dedup_property = db.query(
            DeduplicatedModel,
            ST_X(DeduplicatedModel.coordinates).label('longitude'),
            ST_Y(DeduplicatedModel.coordinates).label('latitude')
        ).filter(
            DeduplicatedModel.del_stavbe_id == deduplicated_id
        ).first()
        
        if not dedup_property:
            return None
        
        # Pridobi VSE povezane del_stavbe zapise z uporabo povezani_del_stavbe_ids polja
        all_del_stavbe = db.query(PropertyModel).filter(
            PropertyModel.del_stavbe_id.in_(dedup_property[0].povezani_del_stavbe_ids)
        ).all()
        
        # Pridobi VSE povezane zapise pogodb z uporabo povezani_posel_ids polja
        if data_source.lower() == "np":
            PoselModel = NpPosel
            all_contracts = db.query(PoselModel).filter(
                PoselModel.posel_id.in_(dedup_property[0].povezani_posel_ids)
            ).all()
        else:
            PoselModel = KppPosel
            all_contracts = db.query(PoselModel).filter(
                PoselModel.posel_id.in_(dedup_property[0].povezani_posel_ids)
            ).all()
        
        # Pridobi reprezentativni zapis za osnovne podatke nepremičnine
        representative_del_stavbe = db.query(PropertyModel).filter(
            PropertyModel.del_stavbe_id == dedup_property[0].najnovejsi_del_stavbe_id
        ).first()
        
        if not representative_del_stavbe:
            return None
        
        # Sestavi odgovor z VSEMI povezanimi podatki
        del_stavbe_records = []
        for record in all_del_stavbe:
            del_stavbe_record = {
                "del_stavbe_id": record.del_stavbe_id,
                "posel_id": record.posel_id,
                "leto": record.leto,
                "povrsina": float(record.povrsina) if record.povrsina else None,
                "povrsina_uporabna": float(record.povrsina_uporabna) if record.povrsina_uporabna else None,
                "opombe": record.opombe
            }
            
            # Dodaj polja specifična za vir podatkov
            if data_source.lower() == "np":
                del_stavbe_record["opremljenost"] = record.opremljenost
                del_stavbe_record["leto_izgradnje_stavbe"] = record.leto_izgradnje_stavbe
            else:
                del_stavbe_record["stevilo_sob"] = record.stevilo_sob
                del_stavbe_record["leto_izgradnje_stavbe"] = record.leto_izgradnje_stavbe
            
            del_stavbe_records.append(del_stavbe_record)
        
        # Sestavi zapise pogodb
        contract_records = []
        for contract in all_contracts:
            contract_record = {
                "posel_id": contract.posel_id,
                "datum_sklenitve": contract.datum_sklenitve.isoformat() if contract.datum_sklenitve else None,
                "posredovanje_agencije": contract.posredovanje_agencije
            }
            
            if data_source.lower() == "np":
                contract_record.update({
                    "najemnina": float(contract.najemnina) if contract.najemnina else None,
                    "vkljuceno_stroski": contract.vkljuceno_stroski,
                    "vkljuceno_ddv": contract.vkljuceno_ddv,
                    "trajanje_najemanja": contract.trajanje_najemanja,
                    "datum_zacetka_najemanja": contract.datum_zacetka_najemanja.isoformat() if contract.datum_zacetka_najemanja else None,
                    "datum_prenehanja_najemanja": contract.datum_prenehanja_najemanja.isoformat() if contract.datum_prenehanja_najemanja else None
                })
            else:
                contract_record.update({
                    "cena": float(contract.cena) if contract.cena else None,
                    "vkljuceno_ddv": contract.vkljuceno_ddv,
                    "trznost_posla": contract.trznost_posla
                })
            
            contract_records.append(contract_record)
        
        # Glavni odgovor z reprezentativnimi podatki + vsi povezani zapisi
        return {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [
                    float(dedup_property.longitude),
                    float(dedup_property.latitude)
                ]
            },
            "properties": {
                "deduplicated_id": dedup_property[0].del_stavbe_id,
                "type": "individual",
                
                # Osnovni podatki nepremičnine iz reprezentativnega zapisa
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
                
                # Povzetek informacij
                "stevilo_poslov": len(dedup_property[0].povezani_posel_ids),
                "ima_vec_poslov": len(dedup_property[0].povezani_posel_ids) > 1,
                
                # VSI povezani podatki za podrobno analizo
                "all_del_stavbe_records": del_stavbe_records,
                "all_contracts": contract_records
            }
        }