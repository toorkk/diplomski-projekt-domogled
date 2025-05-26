import json
from sqlalchemy import func
from sqlalchemy.orm import Session
from geoalchemy2.functions import ST_SetSRID, ST_MakeEnvelope, ST_Intersects, ST_AsGeoJSON, ST_X, ST_Y

from .clustering_utils import calculate_cluster_resolution, get_property_model
from .models import NpPosel, KppPosel


class PropertyService:

    @staticmethod
    def get_building_clustered_properties(west: float, south: float, east: float, north: float, db: Session, data_source: str = "np"):
        """
        Pridobi nepremičnine združene po: sifra_ko, stevilka_stavbe (naredi cluster za vsako stavbo)
        Uporabljeno ko si zoomed in blizu
        """
        PropertyModel = get_property_model(data_source)
        bbox_geom = ST_SetSRID(ST_MakeEnvelope(west, south, east, north), 4326)
        

        cluster_query = db.query(
            func.count(PropertyModel.del_stavbe_id).label('point_count'),
            func.avg(ST_X(PropertyModel.coordinates)).label('avg_lng'),
            func.avg(ST_Y(PropertyModel.coordinates)).label('avg_lat'),
            PropertyModel.sifra_ko,
            PropertyModel.stevilka_stavbe,
            func.avg(PropertyModel.povrsina).label('avg_povrsina'),
            func.array_agg(PropertyModel.obcina.distinct()).label('obcine'),
            func.array_agg(PropertyModel.del_stavbe_id).label('property_ids')
        ).filter(
            ST_Intersects(PropertyModel.coordinates, bbox_geom)
        ).group_by(
            PropertyModel.sifra_ko,
            PropertyModel.stevilka_stavbe
        ).all()
        
        features = []
        for row in cluster_query:
            if row.point_count == 1:
                # Single point
                feature = PropertyService._get_individual_property_feature(
                    db, PropertyModel, row.property_ids[0], data_source
                )
                if feature:
                    features.append(feature)
            else:
                # Multi-point
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
                        "avg_povrsina": float(row.avg_povrsina) if row.avg_povrsina else None,
                        "obcine": [obcina for obcina in row.obcine if obcina] if row.obcine else [],
                        "cluster_id": f"b_{row.sifra_ko}_{row.stevilka_stavbe}",  # Building-level cluster id
                        "sifra_ko": row.sifra_ko,
                        "stevilka_stavbe": row.stevilka_stavbe,
                        "data_source": data_source
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
        Pridobi nepremičnine združene po: razdalji med sabo
        Uporabljeno ko si zoomed srednje
        """
        PropertyModel = get_property_model(data_source)
        resolution = calculate_cluster_resolution(zoom)
        bbox_geom = ST_SetSRID(ST_MakeEnvelope(west, south, east, north), 4326)
        
        cluster_query = db.query(
            func.count(PropertyModel.del_stavbe_id).label('point_count'),
            func.avg(ST_X(PropertyModel.coordinates)).label('avg_lng'),
            func.avg(ST_Y(PropertyModel.coordinates)).label('avg_lat'),
            func.floor(ST_X(PropertyModel.coordinates) / resolution).label('cluster_x'),
            func.floor(ST_Y(PropertyModel.coordinates) / resolution).label('cluster_y'),
            func.avg(PropertyModel.povrsina).label('avg_povrsina'),
            func.array_agg(PropertyModel.obcina.distinct()).label('obcine'),
            func.array_agg(PropertyModel.del_stavbe_id).label('property_ids')
        ).filter(
            ST_Intersects(PropertyModel.coordinates, bbox_geom)
        ).group_by(
            func.floor(ST_X(PropertyModel.coordinates) / resolution),
            func.floor(ST_Y(PropertyModel.coordinates) / resolution)
        ).all()
        
        features = []
        for row in cluster_query:
            if row.point_count == 1:
                # Single point
                feature = PropertyService._get_individual_property_feature(
                    db, PropertyModel, row.property_ids[0], data_source
                )
                if feature:
                    features.append(feature)
            else:
                # Multi-point
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
                        "avg_povrsina": float(row.avg_povrsina) if row.avg_povrsina else None,
                        "obcine": [obcina for obcina in row.obcine if obcina] if row.obcine else [],
                        "cluster_id": f"d_{row.cluster_x}_{row.cluster_y}",  # Distance-based cluster id
                        "data_source": data_source
                    }
                }
                features.append(feature)
        
        return {
            "type": "FeatureCollection",
            "features": features
        }

    @staticmethod
    def _get_individual_property_feature(db: Session, PropertyModel, property_id: int, data_source: str):
        """helper za pridobitev podatkov enega dela stavbe z JOIN na posel tabelo"""
        
        if data_source.lower() == "np":
            # JOIN z najemnimi posli
            individual_property = db.query(
                PropertyModel.del_stavbe_id,
                PropertyModel.obcina,
                PropertyModel.naselje,
                PropertyModel.ulica,
                PropertyModel.hisna_stevilka,
                PropertyModel.dodatek_hs,
                PropertyModel.povrsina,
                PropertyModel.dejanska_raba,
                PropertyModel.leto,
                PropertyModel.posel_id,
                # Podatki iz np_posel tabele
                NpPosel.najemnina,
                NpPosel.datum_sklenitve,
                NpPosel.vkljuceno_stroski,
                NpPosel.vkljuceno_ddv,
                NpPosel.trajanje_najemanja,
                NpPosel.datum_zacetka_najemanja,
                NpPosel.posredovanje_agencije,
                ST_AsGeoJSON(PropertyModel.coordinates).label('geom_json')
            ).join(
                NpPosel, PropertyModel.posel_id == NpPosel.posel_id
            ).filter(PropertyModel.del_stavbe_id == property_id).first()
            
        else:  # kpp
            # JOIN s kupoprodajnimi posli
            individual_property = db.query(
                PropertyModel.del_stavbe_id,
                PropertyModel.obcina,
                PropertyModel.naselje,
                PropertyModel.ulica,
                PropertyModel.hisna_stevilka,
                PropertyModel.dodatek_hs,
                PropertyModel.povrsina,
                PropertyModel.dejanska_raba,
                PropertyModel.leto,
                PropertyModel.posel_id,
                PropertyModel.pogodbena_cena,
                PropertyModel.stevilo_sob,
                PropertyModel.leto_izgradnje_dela_stavbe,
                # Podatki iz kpp_posel tabele
                KppPosel.cena,
                KppPosel.datum_sklenitve,
                KppPosel.vkljuceno_ddv,
                KppPosel.posredovanje_agencije,
                KppPosel.trznost_posla,
                ST_AsGeoJSON(PropertyModel.coordinates).label('geom_json')
            ).join(
                KppPosel, PropertyModel.posel_id == KppPosel.posel_id
            ).filter(PropertyModel.del_stavbe_id == property_id).first()
        
        if not individual_property:
            return None
            
        geom_dict = json.loads(individual_property.geom_json)
        
        # Osnovni podatki (skupni za np in kpp)
        properties = {
            "id": individual_property.del_stavbe_id,
            "type": "individual",
            "obcina": individual_property.obcina,
            "naselje": individual_property.naselje,
            "ulica": individual_property.ulica,
            "hisna_stevilka": individual_property.hisna_stevilka,
            "dodatek_hs": individual_property.dodatek_hs,
            "povrsina": float(individual_property.povrsina) if individual_property.povrsina else None,
            "dejanska_raba": individual_property.dejanska_raba,
            "leto": individual_property.leto,
            "posel_id": individual_property.posel_id,
            "data_source": data_source,
            "datum_sklenitve": individual_property.datum_sklenitve.isoformat() if individual_property.datum_sklenitve else None,
            "posredovanje_agencije": individual_property.posredovanje_agencije
        }
        
        # Dodaj specifične podatke glede na data_source
        if data_source.lower() == "np":
            properties.update({
                "najemnina": float(individual_property.najemnina) if individual_property.najemnina else None,
                "vkljuceno_stroski": individual_property.vkljuceno_stroski,
                "vkljuceno_ddv": individual_property.vkljuceno_ddv,
                "trajanje_najemanja": individual_property.trajanje_najemanja,
                "datum_zacetka_najemanja": individual_property.datum_zacetka_najemanja.isoformat() if individual_property.datum_zacetka_najemanja else None
            })
        else:  # kpp
            properties.update({
                "pogodbena_cena": float(individual_property.pogodbena_cena) if individual_property.pogodbena_cena else None,
                "cena": float(individual_property.cena) if individual_property.cena else None,
                "stevilo_sob": individual_property.stevilo_sob,
                "leto_izgradnje_dela_stavbe": individual_property.leto_izgradnje_dela_stavbe,
                "vkljuceno_ddv": individual_property.vkljuceno_ddv,
                "trznost_posla": individual_property.trznost_posla
            })
        
        return {
            "type": "Feature",
            "geometry": geom_dict,
            "properties": properties
        }
    

    # Metoda da pridobima vse podatke ki spadajo pod cluster (cluster ki je zdruzil nepremicnine glede stavbo)
    @staticmethod
    def get_building_cluster_properties(sifra_ko: int, stevilka_stavbe: int, db: Session, data_source: str = "np"):
        """
        Pridobi vse nepremičnine v določeni stavbi - z error handling
        """
        PropertyModel = get_property_model(data_source)
        
        # Poiščemo vse property_ids v tej stavbi
        property_ids = db.query(PropertyModel.del_stavbe_id).filter(
            PropertyModel.sifra_ko == sifra_ko,
            PropertyModel.stevilka_stavbe == stevilka_stavbe
        ).all()
        
        print(f"Found {len(property_ids)} property IDs in building")  # Debug
        
        features = []
        skipped_properties = 0
        
        for prop_id_row in property_ids:
            try:
                # Ponovno uporabimo obstoječo funkcijo za vsako nepremičnino
                feature = PropertyService._get_individual_property_feature(
                    db, PropertyModel, prop_id_row.del_stavbe_id, data_source
                )
                if feature:
                    features.append(feature)
                else:
                    print(f"Property ID {prop_id_row.del_stavbe_id} returned None - skipping")
                    skipped_properties += 1
            except Exception as e:
                print(f"Error processing property ID {prop_id_row.del_stavbe_id}: {str(e)}")
                skipped_properties += 1
                continue
        
        if skipped_properties > 0:
            print(f"Warning: Skipped {skipped_properties} properties due to missing JOIN data")
        
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