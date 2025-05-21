from fastapi import Depends, FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import create_engine, Column, Integer, Text, Numeric, SmallInteger, func, String
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from geoalchemy2 import Geometry
from geoalchemy2.functions import ST_Transform, ST_SetSRID, ST_MakeEnvelope, ST_Intersects, ST_AsGeoJSON, ST_X, ST_Y
import os
import asyncio
from dotenv import load_dotenv
import json
import math

import requests

from .data_ingestion import DataIngestionService


load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Definicija sheme baze za NP del stavbe
class NpDelStavbe(Base):
    __tablename__ = "np_del_stavbe"
    __table_args__ = {"schema": "core"}
    
    del_stavbe_id = Column(Integer, primary_key=True)
    posel_id = Column(Integer, nullable=False)
    sifra_ko = Column(SmallInteger, nullable=False)
    ime_ko = Column(Text)
    obcina = Column(Text)
    stevilka_stavbe = Column(Integer)
    stevilka_dela_stavbe = Column(Integer)
    naselje = Column(Text)
    ulica = Column(Text)
    hisna_stevilka = Column(Text)
    dodatek_hs = Column(Text)
    stev_stanovanja = Column(Integer)
    opremljenost = Column(SmallInteger)
    dejanska_raba = Column(Text)
    lega_dela_stavbe = Column(Text)
    povrsina = Column(Numeric)
    povrsina_uporabna = Column(Numeric)
    gostinski_vrt = Column(SmallInteger)
    vkljucen_gostinski_vrt_v_najemnino = Column(SmallInteger)
    coordinates = Column(Geometry('POINT', srid=4326))
    leto = Column(Integer)
    vrsta_prostorov_code = Column(SmallInteger)
    vrsta_prostorov_desc = Column(Text)

# Definicija sheme baze za KPP del stavbe
class KppDelStavbe(Base):
    __tablename__ = "kpp_del_stavbe"
    __table_args__ = {"schema": "core"}
    
    del_stavbe_id = Column(Integer, primary_key=True, autoincrement=True)
    posel_id = Column(Integer, nullable=False)
    sifra_ko = Column(SmallInteger, nullable=False)
    ime_ko = Column(String(101))
    obcina = Column(String(102))
    stevilka_stavbe = Column(Integer)
    stevilka_dela_stavbe = Column(Integer)
    
    naselje = Column(String(103))
    ulica = Column(String(300))
    hisna_stevilka = Column(String(40))
    dodatek_hs = Column(String(10))
    stev_stanovanja = Column(Integer)
    vrsta = Column(SmallInteger)
    leto_izgradnje_dela_stavbe = Column(Integer)
    stavba_je_dokoncana = Column(Integer)
    gradbena_faza = Column(Integer)
    novogradnja = Column(Integer)
    prodana_povrsina = Column(Numeric(10, 2))
    prodani_delez = Column(String(199))
    prodana_povrsina_dela_stavbe = Column(Numeric(10, 2))
    prodana_uporabna_povrsina_dela_stavbe = Column(Numeric(10, 2))
    nadstropje = Column(String(50))
    stevilo_zunanjih_parkirnih_mest = Column(Integer)
    atrij = Column(Integer)
    povrsina_atrija = Column(Numeric(10, 2))
    opombe = Column(Text)
    dejanska_raba = Column(String(310))
    lega_v_stavbi = Column(String(20))
    stevilo_sob = Column(Integer)
    povrsina = Column(Numeric(10, 2))
    povrsina_uporabna = Column(Numeric(10, 2))
    prostori = Column(Text)
    pogodbena_cena = Column(Numeric(12, 2))
    stopnja_ddv = Column(Numeric(5, 2))
    
    coordinates = Column(Geometry('Point', 4326))
    leto = Column(Integer)


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def root():
    return {"message": "Domogled API"}


ingestion_service = DataIngestionService(DATABASE_URL)


@app.post("/api/ingest-data")
async def ingest_data(
    background_tasks: BackgroundTasks,
    data_type: str = Query("kpp", description="Tip podatkov (np ali kpp)"),
    filter_param: str = Query("DRZAVA", description="Filter parameter"),
    filter_value: str = Query("1", description="Filter vrednost"),
    start_year: int = None,
    end_year: int = Query(2025, description="Končno leto")
):
    """API endpoint za zagon vnosa podatkov za razpon let"""
    try:

        if start_year is None:
            if data_type == "kpp":
                start_year = 2007
            else:  # np data
                start_year = 2013
        
        if start_year > end_year:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Začetno leto mora biti manjše ali enako končnemu letu"}
            )
        
        if data_type not in ["np", "kpp"]:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Data type mora biti 'np' ali 'kpp'"}
            )
            
        # Dodamo opravila za vsako leto v razponu
        for year in range(start_year, end_year + 1):
            background_tasks.add_task(
                ingestion_service.run_ingestion,
                filter_param=filter_param,
                filter_value=filter_value,
                filter_year=str(year),
                data_type=data_type
            )
        
        return JSONResponse(
            status_code=202,
            content={
                "status": "accepted",
                "message": f"Vnos podatkov '{data_type}' se je začel za leta od {start_year} do {end_year}",
                "params": {
                    "data_type": data_type,
                    "filter_param": filter_param,
                    "filter_value": filter_value,
                    "years": list(range(start_year, end_year + 1))
                }
            }
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(e)}
        )
    

@app.get("/api/ingestion-status")
async def ingestion_status():
    """Preveri status vnosa podatkov"""
    try:
        if os.path.exists("data_ingestion.log"):
            with open("data_ingestion.log", "r") as f:
                last_lines = f.readlines()[-20:]
        else:
            last_lines = ["Vnos podatkov še ni bil zagnan."]
        
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "last_logs": last_lines
            }
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(e)}
        )



def calculate_cluster_resolution(zoom_level: float) -> float:
    """
    Izračun prostorske ločljivosti za združevanje v clusters na podlagi stopnje povečave.
    Večja povečava = manjši clusters
    Manjša povečava = večji clusters
    """
    # At zoom 12, cluster radius ≈ 0.001 degrees (≈77m in Slovenia longitude)
    # At zoom 6, cluster radius ≈ 0.1 degrees (≈7.7km in Slovenia longitude)
    base_resolution = 0.01  # Resolution at zoom 12
    zoom_factor = 2 ** (12 - zoom_level)
    return base_resolution * zoom_factor

def get_property_model(data_source: str):
    """
    vrne model odvisno od tega če pošiljaš kpp ali np podatke na frontend
    """
    if data_source.lower() == "kpp":
        return KppDelStavbe
    else:
        return NpDelStavbe

def get_building_clustered_properties(west: float, south: float, east: float, north: float, db: Session, data_source: str = "np"):
    """
    Get properties clustered by building (sifra_ko and stevilka_stavbe)
    Used for medium zoom levels
    """
    PropertyModel = get_property_model(data_source)
    bbox_geom = ST_SetSRID(ST_MakeEnvelope(west, south, east, north), 4326)
    
    # SQL query to create clusters using sifra_ko and stevilka_stavbe
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
            # Single point - get full individual property data
            property_id = row.property_ids[0]
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
            
            if individual_property:
                geom_dict = json.loads(individual_property.geom_json)
                
                # Create properties object with common fields
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
                    "data_source": data_source  # Add data source as property
                }
                
                # Add KPP specific properties if using KPP data source
                if data_source.lower() == "kpp" and hasattr(individual_property, "pogodbena_cena"):
                    properties.update({
                        "pogodbena_cena": float(individual_property.pogodbena_cena) if individual_property.pogodbena_cena else None,
                        "stevilo_sob": individual_property.stevilo_sob if hasattr(individual_property, "stevilo_sob") else None,
                        "leto_izgradnje_dela_stavbe": individual_property.leto_izgradnje_dela_stavbe if hasattr(individual_property, "leto_izgradnje_dela_stavbe") else None
                    })
                
                feature = {
                    "type": "Feature",
                    "geometry": geom_dict,
                    "properties": properties
                }
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
                    "avg_povrsina": float(row.avg_povrsina) if row.avg_povrsina else None,
                    "obcine": [obcina for obcina in row.obcine if obcina] if row.obcine else [],
                    "cluster_id": f"b_{row.sifra_ko}_{row.stevilka_stavbe}",  # Building-level cluster ID
                    "sifra_ko": row.sifra_ko,
                    "stevilka_stavbe": row.stevilka_stavbe,
                    "data_source": data_source  # Add data source as property
                }
            }
            features.append(feature)
    
    return {
        "type": "FeatureCollection",
        "features": features
    }


def get_distance_clustered_properties(west: float, south: float, east: float, north: float, zoom: float, db: Session, data_source: str = "np"):
    """
    Get properties clustered by geographic distance
    Used for low zoom levels
    """
    PropertyModel = get_property_model(data_source)
    resolution = calculate_cluster_resolution(zoom)
    bbox_geom = ST_SetSRID(ST_MakeEnvelope(west, south, east, north), 4326)
    
    # SQL query to create clusters using PostGIS and geographic grid
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
            # Single point - get full individual property data
            property_id = row.property_ids[0]
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
            
            if individual_property:
                geom_dict = json.loads(individual_property.geom_json)
                
                # Create properties object with common fields
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
                    "data_source": data_source  # Add data source as property
                }
                
                # Add KPP specific properties if using KPP data source
                if data_source.lower() == "kpp" and hasattr(individual_property, "pogodbena_cena"):
                    properties.update({
                        "pogodbena_cena": float(individual_property.pogodbena_cena) if individual_property.pogodbena_cena else None,
                        "stevilo_sob": individual_property.stevilo_sob if hasattr(individual_property, "stevilo_sob") else None,
                        "leto_izgradnje_dela_stavbe": individual_property.leto_izgradnje_dela_stavbe if hasattr(individual_property, "leto_izgradnje_dela_stavbe") else None
                    })
                
                feature = {
                    "type": "Feature",
                    "geometry": geom_dict,
                    "properties": properties
                }
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
                    "avg_povrsina": float(row.avg_povrsina) if row.avg_povrsina else None,
                    "obcine": [obcina for obcina in row.obcine if obcina] if row.obcine else [],
                    "cluster_id": f"d_{row.cluster_x}_{row.cluster_y}",  # Distance-based cluster ID
                    "data_source": data_source  # Add data source as property
                }
            }
            features.append(feature)
    
    return {
        "type": "FeatureCollection",
        "features": features
    }


@app.get("/properties/geojson")
def get_properties_geojson(
    bbox: str = Query(..., description="Bounding box as 'west,south,east,north'"),
    zoom: float = Query(default=10, description="Zoom level for clustering"),
    data_source: str = Query(default="np", description="Data source: 'np' for normal properties or 'kpp' for contract properties"),
    db: Session = Depends(get_db)
):
    """
    Pridobi dele stavb trenutno vidne na ekranu z dvostopenjskim sistemom razvrščanja v gruče:
    - Visok zoom (>= cluster_threshold): Združeni po stavbah (sifra_ko in stevilka_stavbe)
    - Nizek zoom (< cluster_threshold): Združeni po geografski razdalji
    
    Parameter data_source omogoča preklapljanje med različnimi viri podatkov:
    - 'np': običajni podatki (np_del_stavbe)
    - 'kpp': podatki o kupoprodajnih pogodbah (kpp_del_stavbe)
    """
    try:
        # Validate data_source parameter
        if data_source.lower() not in ["np", "kpp"]:
            raise ValueError("data_source parameter must be either 'np' or 'kpp'")
            
        west, south, east, north = map(float, bbox.split(','))
        
        cluster_threshold = 14.5  # Above this, cluster by building; below, cluster by distance
        
        if zoom >= cluster_threshold:
            # Higher zoom - cluster by building (sifra_ko and stevilka_stavbe)
            return get_building_clustered_properties(west, south, east, north, db, data_source)
        else:
            # Lower zoom - cluster by geographic distance
            return get_distance_clustered_properties(west, south, east, north, zoom, db, data_source)
            
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"neveljavni parametri: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"db error: {str(e)}")