from pydantic import BaseModel, ConfigDict
from decimal import Decimal
from datetime import date, datetime
from .models import KppPosel, NpDelStavbe, KppDelStavbe, KppDelStavbeDeduplicated, NpDelStavbeDeduplicated, NpPosel


def calculate_cluster_resolution(zoom_level: float) -> float:
    """
    Izračun prostorske ločljivosti za združevanje v clusters na podlagi stopnje povečave.
    Večja povečava = manjši clusters
    Manjša povečava = večji clusters
    """
    # zoom 12, cluster radius ≈ 0.001 degrees (≈77m in Slovenia)
    # zoom 6, cluster radius ≈ 0.1 degrees (≈7.7km in Slovenia)
    base_resolution = 0.01  # Resolution at zoom 12
    zoom_factor = 2 ** (12 - zoom_level)
    return base_resolution * zoom_factor


def get_del_stave_model(data_source: str):
    if data_source.lower() == "kpp":
        return KppDelStavbe
    else:
        return NpDelStavbe

def get_posel_model(data_source: str):
    if data_source.lower() == "kpp":
        return KppPosel
    else:
        return NpPosel


def get_deduplicated_del_stavbe_model(data_source: str):
    if data_source.lower() == "kpp":
        return KppDelStavbeDeduplicated
    else:
        return NpDelStavbeDeduplicated


def serialize_to_json(obj):
    """
    pretvori objekt SQLAlchemy v JSON dictionary.
    """
    if obj is None:
        return None
    
    result = {}
    
    try:
    
        result = {}
        for column in obj.__table__.columns:
            column_name = column.name
            value = getattr(obj, column_name, None)
            
            if value is None:
                result[column_name] = None
            elif isinstance(value, Decimal):
                result[column_name] = float(value)
            elif isinstance(value, (date, datetime)):
                result[column_name] = value.isoformat()
            elif isinstance(value, (int, float, str, bool, list)):
                result[column_name] = value
            elif hasattr(value, '__geo_interface__'):
                continue  # Skip geometry
            else:
                result[column_name] = str(value)
                
    except Exception as e:
        print(f"Napaka v serialize_to_json: {e}")
        return {"error": "Serializacija neuspešna"}
    
    return result


def serialize_list_to_json(objects):
    """pretvorite seznam predmetov SQLAlchemy v JSON"""
    if not objects:
        return []
    
    try:
        return [serialize_to_json(obj) for obj in objects if obj is not None]
    except Exception as e:
        print(f"Napaka v serialize_list_to_json: {e}")
        return []
    

def apply_del_stavbe_filters(query, DeduplicatedModel, filters: dict, data_source: str):
    """
    Dodaj filtre queryju
    """
    if not filters:
        filters = {}
    
    # Nastavi privzeto leto če ni podano
    filter_leto = filters.get('filter_leto', 2025)
    query = query.filter(DeduplicatedModel.zadnje_leto >= filter_leto)
    
    if data_source.lower() == "np":
        if filters.get('min_cena'):
            query = query.filter(DeduplicatedModel.zadnja_najemnina >= filters['min_cena'])
        if filters.get('max_cena'):
            query = query.filter(DeduplicatedModel.zadnja_najemnina <= filters['max_cena'])
    else:
        if filters.get('min_cena'):
            query = query.filter(DeduplicatedModel.zadnja_cena >= filters['min_cena'])
        if filters.get('max_cena'):
            query = query.filter(DeduplicatedModel.zadnja_cena <= filters['max_cena'])
    
    if filters.get('min_povrsina'):
        query = query.filter(DeduplicatedModel.povrsina_uradna >= filters['min_povrsina'])
    if filters.get('max_povrsina'):
        query = query.filter(DeduplicatedModel.povrsina_uradna <= filters['max_povrsina'])
    
    return query