from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, Text, Numeric, SmallInteger, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from geoalchemy2 import Geometry
from geoalchemy2.functions import ST_Transform, ST_SetSRID, ST_MakeEnvelope, ST_Intersects, ST_AsGeoJSON, ST_X, ST_Y
import os
from dotenv import load_dotenv
import json
import math


load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

#definicija sheme baze
class DelStavbe(Base):
    __tablename__ = "del_stavbe"
    __table_args__ = {"schema": "core"}
    
    del_stavbe_id = Column(Integer, primary_key=True)
    posel_id = Column(Integer, nullable=False)
    sifra_ko = Column(SmallInteger, nullable=False)
    ime_ko = Column(Text, nullable=False)
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




def get_individual_properties(west: float, south: float, east: float, north: float, db: Session):

    bbox_geom = ST_SetSRID(ST_MakeEnvelope(west, south, east, north), 4326)
    
    query = db.query(
        DelStavbe.del_stavbe_id,
        DelStavbe.obcina,
        DelStavbe.naselje,
        DelStavbe.ulica,
        DelStavbe.hisna_stevilka,
        DelStavbe.povrsina,
        DelStavbe.dejanska_raba,
        DelStavbe.leto,
        ST_AsGeoJSON(DelStavbe.coordinates).label('geom_json')
    ).filter(
        ST_Intersects(DelStavbe.coordinates, bbox_geom)
    ).limit(10000)
    
    results = query.all()
    
    features = []
    for row in results:
        geom_dict = json.loads(row.geom_json)
        
        feature = {
            "type": "Feature",
            "geometry": geom_dict,
            "properties": {
                "id": row.del_stavbe_id,
                "type": "individual",
                "obcina": row.obcina,
                "naselje": row.naselje,
                "ulica": row.ulica,
                "hisna_stevilka": row.hisna_stevilka,
                "povrsina": float(row.povrsina) if row.povrsina else None,
                "dejanska_raba": row.dejanska_raba,
                "leto": row.leto
            }
        }
        features.append(feature)
    
    return {
        "type": "FeatureCollection",
        "features": features
    }



def get_clustered_properties(west: float, south: float, east: float, north: float, zoom: float, db: Session):
    resolution = calculate_cluster_resolution(zoom)
    bbox_geom = ST_SetSRID(ST_MakeEnvelope(west, south, east, north), 4326)
    
    # SQL query to create clusters using PostGIS
    cluster_query = db.query(
        func.count(DelStavbe.del_stavbe_id).label('point_count'),
        func.avg(ST_X(DelStavbe.coordinates)).label('avg_lng'),
        func.avg(ST_Y(DelStavbe.coordinates)).label('avg_lat'),
        func.floor(ST_X(DelStavbe.coordinates) / resolution).label('cluster_x'),
        func.floor(ST_Y(DelStavbe.coordinates) / resolution).label('cluster_y'),
        func.avg(DelStavbe.povrsina).label('avg_povrsina'),
        func.array_agg(DelStavbe.obcina.distinct()).label('obcine'),
        func.array_agg(DelStavbe.del_stavbe_id).label('property_ids')
    ).filter(
        ST_Intersects(DelStavbe.coordinates, bbox_geom)
    ).group_by(
        func.floor(ST_X(DelStavbe.coordinates) / resolution),
        func.floor(ST_Y(DelStavbe.coordinates) / resolution)
    ).all()
    
    features = []
    for row in cluster_query:
        if row.point_count == 1:
            # Single point - get full individual property data
            property_id = row.property_ids[0]
            individual_property = db.query(
                DelStavbe.del_stavbe_id,
                DelStavbe.obcina,
                DelStavbe.naselje,
                DelStavbe.ulica,
                DelStavbe.hisna_stevilka,
                DelStavbe.povrsina,
                DelStavbe.dejanska_raba,
                DelStavbe.leto,
                ST_AsGeoJSON(DelStavbe.coordinates).label('geom_json')
            ).filter(DelStavbe.del_stavbe_id == property_id).first()
            
            if individual_property:
                geom_dict = json.loads(individual_property.geom_json)
                feature = {
                    "type": "Feature",
                    "geometry": geom_dict,
                    "properties": {
                        "id": individual_property.del_stavbe_id,
                        "type": "individual",
                        "obcina": individual_property.obcina,
                        "naselje": individual_property.naselje,
                        "ulica": individual_property.ulica,
                        "hisna_stevilka": individual_property.hisna_stevilka,
                        "povrsina": float(individual_property.povrsina) if individual_property.povrsina else None,
                        "dejanska_raba": individual_property.dejanska_raba,
                        "leto": individual_property.leto
                    }
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
                    "point_count": row.point_count,
                    "avg_povrsina": float(row.avg_povrsina) if row.avg_povrsina else None,
                    "obcine": [obcina for obcina in row.obcine if obcina] if row.obcine else [],
                    "cluster_id": f"{row.cluster_x}_{row.cluster_y}"
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
    db: Session = Depends(get_db)
):
    """
    Pridobi dele stavb trenutno vidne na ekranu
    """
    try:
        west, south, east, north = map(float, bbox.split(','))
        
        cluster_threshold = 200
        
        if zoom >= cluster_threshold:
            # High zoom - return individual points
            return get_individual_properties(west, south, east, north, db)
        else:
            # Low zoom - return clusters
            return get_clustered_properties(west, south, east, north, zoom, db)
            
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"neveljavni bounding box koordinati: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"db error: {str(e)}")