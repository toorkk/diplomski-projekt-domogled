import json
from sqlalchemy import func
from sqlalchemy.orm import Session
from geoalchemy2.functions import ST_SetSRID, ST_MakeEnvelope, ST_Intersects, ST_AsGeoJSON, ST_X, ST_Y

from .clustering_utils import calculate_cluster_resolution, get_property_model


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
        """helper za pridobitev podatkov enega dela stavbe"""
        individual_property = db.query(
            PropertyModel.del_stavbe_id,
            PropertyModel.obcina,
            PropertyModel.naselje,
            PropertyModel.ulica,
            PropertyModel.hisna_stevilka,
            PropertyModel.povrsina,
            PropertyModel.dejanska_raba,
            PropertyModel.leto,
            ST_AsGeoJSON(PropertyModel.coordinates).label('geom_json')
        ).filter(PropertyModel.del_stavbe_id == property_id).first()
        
        if not individual_property:
            return None
            
        geom_dict = json.loads(individual_property.geom_json)
        
        properties = {
            "id": individual_property.del_stavbe_id,
            "type": "individual",
            "obcina": individual_property.obcina,
            "naselje": individual_property.naselje,
            "ulica": individual_property.ulica,
            "hisna_stevilka": individual_property.hisna_stevilka,
            "povrsina": float(individual_property.povrsina) if individual_property.povrsina else None,
            "dejanska_raba": individual_property.dejanska_raba,
            "leto": individual_property.leto,
            "data_source": data_source
        }
        
        # kpp specificni fields
        if data_source.lower() == "kpp":

            kpp_property = db.query(PropertyModel).filter(
                PropertyModel.del_stavbe_id == property_id
            ).first()
            
            if kpp_property:
                properties.update({
                    "pogodbena_cena": float(kpp_property.pogodbena_cena) if kpp_property.pogodbena_cena else None,
                    "stevilo_sob": kpp_property.stevilo_sob,
                    "leto_izgradnje_dela_stavbe": kpp_property.leto_izgradnje_dela_stavbe
                })
        
        return {
            "type": "Feature",
            "geometry": geom_dict,
            "properties": properties
        }