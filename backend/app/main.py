from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, Text, Numeric, SmallInteger, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from geoalchemy2 import Geometry
from geoalchemy2.functions import ST_SetSRID, ST_MakeEnvelope, ST_Intersects, ST_AsGeoJSON
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
    return {"message": "Backend is working"}

@app.get("/properties/geojson")
def get_properties_geojson(
    bbox: str = Query(..., description="Bounding box as 'west,south,east,north'"),
    db: Session = Depends(get_db)
):
    """
    Pridobi dele stavb ki bi naj bile trenutno vidne na ekranu
    """
    try:
        west, south, east, north = map(float, bbox.split(','))
        
        # Create bounding box geometry in WGS84 (SRID 4326)
        bbox_geom = ST_SetSRID(ST_MakeEnvelope(west, south, east, north), 4326)
        
        # Simple, fast query - no transformations needed
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
        ).limit(10000)  # LIMIT
        
        # Zaženi query
        results = query.all()
        
        # Ustvari GeoJSON FeatureCollection
        features = []
        for row in results:

            geom_dict = json.loads(row.geom_json)
            
            feature = {
                "type": "Feature",
                "geometry": geom_dict,
                "properties": {
                    "id": row.del_stavbe_id,
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
        
        # Vrni GeoJSON FeatureCollection
        geojson = {
            "type": "FeatureCollection",
            "features": features
        }
        
        return geojson
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"neveljavni bounding box koordinati: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"db error: {str(e)}")