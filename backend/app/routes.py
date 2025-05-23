import os
from fastapi import Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from .database import get_db, DATABASE_URL
from .property_service import PropertyService
from .data_ingestion import DataIngestionService


ingestion_service = DataIngestionService(DATABASE_URL)

# =============================================================================
# DATA INGESTION ENDPOINTI
# =============================================================================

async def ingest_data(
    background_tasks: BackgroundTasks,  
    data_type: str = Query("kpp", description="Tip podatkov (np ali kpp)"),
    start_year: int = Query(None, description="Začetno leto"),
    end_year: int = Query(2025, description="Končno leto")
):
    """API endpoint za zagon vnosa podatkov za razpon let"""
    try:

        if start_year is None:
            if data_type == "kpp":
                start_year = 2007
            else:  # np
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
                filter_year=str(year),
                data_type=data_type
            )
            pass
        
        return JSONResponse(
            status_code=202,
            content={
                "status": "accepted",
                "message": f"Vnos podatkov '{data_type}' se je začel za leta od {start_year} do {end_year}",
                "params": {
                    "data_type": data_type,
                    "years": list(range(start_year, end_year + 1))
                }
            }
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(e)}
        )

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

# =============================================================================
# PROPERTY ENDPOINTI
# =============================================================================

def get_properties_geojson(
    bbox: str = Query(..., description="Bounding box 'west,south,east,north'"),
    zoom: float = Query(default=10, description="Zoom level za clustering"),
    data_source: str = Query(default="np", description="Data source: 'np' za najemne 'kpp' za kupoprodajne"),
    db: Session = Depends(get_db)
):
    """
    Pridobi dele stavb trenutno vidne na ekranu z dvostopenjskim sistemom razvrščanja v gruče:
    - Visok zoom (>= cluster_threshold): Združeni po stavbah (sifra_ko in stevilka_stavbe)
    - Nizek zoom (< cluster_threshold): Združeni po geografski razdalji
    
    Parameter data_source omogoča preklapljanje med različnimi viri podatkov:
    - 'np': najemni podatki (np_del_stavbe)
    - 'kpp': kupoprodajni podatki (kpp_del_stavbe)
    """
    try:

        if data_source.lower() not in ["np", "kpp"]:
            raise ValueError("data_source mora bit 'np' ali 'kpp'")
            
        west, south, east, north = map(float, bbox.split(','))
        
        cluster_threshold = 14.5
        
        if zoom >= cluster_threshold:
            return PropertyService.get_building_clustered_properties(west, south, east, north, db, data_source)
        else:
            return PropertyService.get_distance_clustered_properties(west, south, east, north, zoom, db, data_source)
            
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"neveljavni parametri: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"db error: {str(e)}")