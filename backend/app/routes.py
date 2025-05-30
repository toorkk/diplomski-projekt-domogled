import os
from fastapi import Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from .database import get_db, DATABASE_URL
from .property_service import PropertyService
from .data_ingestion import DataIngestionService
from .deduplication import DeduplicationService
from .energetska_izkaznica_ingestion import EnergetskaIzkaznicaIngestionService


ingestion_service = DataIngestionService(DATABASE_URL)

deduplication_service = DeduplicationService(DATABASE_URL)

ei_ingestion_service = EnergetskaIzkaznicaIngestionService(DATABASE_URL)

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
        
        return JSONResponse(
            status_code=202,
            content={
                "status": "accepted",
                "message": f"Vnos podatkov '{data_type}' se je začel za leta od {start_year} do {end_year}",
                "params": {
                    "data_type": data_type,
                    "years": list(range(start_year, end_year + 1))
                },
                "next_step": {
                    "message": "Ko je vnos končan, zaženi deduplication",
                    "endpoint": "/api/fill-deduplicated-tables",
                    "note": "Deduplication gre skozi vse leta in se more zagnat po tem ko je vnos podatkov ČISTO končan. Reflektiral bo samo leta ki so trenutno naložena v bazo"
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



async def fill_deduplicated_tables(
    background_tasks: BackgroundTasks,
    data_type: str = Query(None, description="Tip podatkov (np, kpp, ali all za oba)")
):
    """
    API endpoint za ustvarjanje deduplicirane tabele po končanem vnosu podatkov.
    Zaženi to ENKRAT po tem, ko so vsi podatki za vsa leta vnešeni.
    """
    try:
        if data_type and data_type.lower() not in ["np", "kpp", "all"]:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Data type mora biti 'np', 'kpp' ali 'all'"}
            )

        if data_type is None or data_type.lower() == "all":
            # Obdelaj oba tipa podatkov
            background_tasks.add_task(
                deduplication_service.create_all_deduplicated_properties,
                ["np", "kpp"]
            )
            message = "Dedupliciranje se je začelo za podatke NP in KPP"
        else:
            # Obdelaj en tip podatkov
            background_tasks.add_task(
                deduplication_service.create_deduplicated_properties,
                data_type.lower()
            )
            message = f"Dedupliciranje se je začelo za podatke {data_type.upper()}"

        return JSONResponse(
            status_code=202,
            content={
                "status": "accepted",
                "message": message,
                "note": "Ta proces bo analiziral VSE letne podatke in ustvaril deduplicirane lastnosti za hiter prikaz na zemljevidu"
            }
        )

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(e)}
        )



async def deduplication_status(
    data_type: str = Query(None, description="Tip podatkov (np, kpp, ali all)")
):
    """
    API endpoint za pridobitev statistike deduplikacije.
    """
    try:
        if data_type and data_type.lower() not in ["np", "kpp", "all"]:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Data type mora biti 'np', 'kpp' ali 'all'"}
            )

        if data_type and data_type.lower() != "all":
            stats = deduplication_service.get_deduplication_stats(data_type.lower())
        else:
            stats = deduplication_service.get_deduplication_stats()

        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "deduplication_stats": stats
            }
        )

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(e)}
        )


async def ingest_energetske_izkaznice(
    background_tasks: BackgroundTasks,
    url: str = Query(None, description="Opcijski direktni URL do CSV datoteke")
):
    """
    API endpoint za uvoz energetskih izkaznic.
    Če URL ni podan, bo avtomatsko generiral URL za trenutni mesec.
    """
    try:
        background_tasks.add_task(
            ei_ingestion_service.run_ingestion,
            url=url
        )
        
        return JSONResponse(
            status_code=202,
            content={
                "status": "accepted",
                "message": "Uvoz energetskih izkaznic se je začel",
                "note": "Preveri status z /api/energetske-izkaznice/status endpointom"
            }
        )
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(e)}
        )

async def energetske_izkaznice_status():
    """Preveri status uvoza energetskih izkaznic"""
    try:
        # Preberi zadnje vrstice iz log datoteke
        if os.path.exists("energetska_izkaznica_ingestion.log"):
            with open("energetska_izkaznica_ingestion.log", "r", encoding='utf-8') as f:
                last_lines = f.readlines()[-20:]
        else:
            last_lines = ["Uvoz energetskih izkaznic še ni bil zagnan."]
        
        # Preveri tudi število zapisov v bazi
        try:
            with ei_ingestion_service.engine.connect() as conn:
                count = conn.execute(text("SELECT COUNT(*) FROM core.energetska_izkaznica")).scalar()
                last_updated = conn.execute(text(
                    "SELECT MAX(datum_uvoza) FROM core.energetska_izkaznica"
                )).scalar()
        except:
            count = 0
            last_updated = None
        
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "database_stats": {
                    "total_records": count,
                    "last_updated": str(last_updated) if last_updated else None
                },
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
    municipality: str = Query(None, description="Filter po občini (opcijsko)"),  
    sifko: int = Query(None, description="Filter po šifri katastrske občine (opcijsko)"),  # NOVO DODANO
    db: Session = Depends(get_db)
):
    """
    Pridobi dele stavb trenutno vidne na ekranu:
    - Če je podan sifko/municipality: Vrni VSE nepremičnine v tej občini (ignore bbox, samo building clustering)
    - Sicer: Uporabi bbox z distance/building clustering
    
    Parameter data_source omogoča preklapljanje med različnimi viri podatkov:
    - 'np': najemni podatki (np_del_stavbe)
    - 'kpp': kupoprodajni podatki (kpp_del_stavbe)
    """
    try:

        if data_source.lower() not in ["np", "kpp"]:
            raise ValueError("data_source mora bit 'np' ali 'kpp'")
            
        west, south, east, north = map(float, bbox.split(','))
        
        # Če je podan sifko ali municipality, vrni VSE nepremičnine v tej občini
        if sifko or municipality:
            return PropertyService.get_municipality_all_properties(sifko, municipality, db, data_source)
        
        # Sicer uporabi stari sistem z bbox clustering
        cluster_threshold = 14.5
        
        if zoom >= cluster_threshold:
            return PropertyService.get_building_clustered_properties(west, south, east, north, db, data_source, municipality, sifko)
        else:
            return PropertyService.get_distance_clustered_properties(west, south, east, north, zoom, db, data_source, municipality, sifko)
            
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"neveljavni parametri: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"db error: {str(e)}")
    

def get_property_details(
    deduplicated_id: int,
    data_source: str = Query(default="np", description="Data source: 'np' za najemne 'kpp' za kupoprodajne"),
    db: Session = Depends(get_db)
):
    """
    Po kliku na zemljevid pridobite vse podrobnosti za določeno deduplicirano nepremičnino.
    Vrne VSE povezane posle in dele_stavb.
    """
    try:
        if data_source.lower() not in ["np", "kpp"]:
            raise ValueError("data_source mora bit 'np' ali 'kpp'")
        
        property_details = PropertyService.get_property_details(deduplicated_id, data_source, db)
        
        if not property_details:
            raise HTTPException(status_code=404, detail="Property not found")
        
        return property_details
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"neveljavni parametri: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"db error: {str(e)}")
    
    
# =============================================================================
# CLUSTER ENDPOINTI  
# =============================================================================

def get_cluster_properties(
    cluster_id: str,
    data_source: str = Query(default="np", description="Data source: 'np' za najemne 'kpp' za kupoprodajne"),
    db: Session = Depends(get_db)
):
    """
    Pridobi vse nepremičnine ki spadajo pod določen building cluster
    """
    try:
        print(f"Received cluster_id: {cluster_id}")  # Debug
        
        if data_source.lower() not in ["np", "kpp"]:
            raise ValueError("data_source mora bit 'np' ali 'kpp'")
        
        # Podporni samo building clustri
        if cluster_id.startswith('b_'):
            # Building cluster: b_obcina_sifra_ko_stevilka_stavbe
            parts = cluster_id[2:].split('_')
            print(f"Building cluster parts: {parts}")  # Debug
            
            if len(parts) >= 3:  # Spremenil iz 2 na 3 (obcina + sifra_ko + stevilka_stavbe)
                obcina = parts[0]  # Nova
                sifra_ko = int(parts[1])  # Spremenjeno iz parts[0]
                stevilka_stavbe = int(parts[2])  # Spremenjeno iz parts[1]
                
                print(f"Looking for obcina: {obcina}, sifra_ko: {sifra_ko}, stevilka_stavbe: {stevilka_stavbe}")  # Debug
                
                # Posreduj občino v PropertyService
                return PropertyService.get_building_cluster_properties(obcina, sifra_ko, stevilka_stavbe, db, data_source)
                
        elif cluster_id.startswith('d_'):
            # Distance clustri niso podprti za expansion
            raise ValueError("Distance clustri ne podpirajo expansion funkcionalnosti")
        
        else:
            raise ValueError(f"Nepodprt tip clusterja: {cluster_id}")
            
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"neveljavni parametri: {str(e)}")
    except Exception as e:
        print(f"Error in get_cluster_properties: {str(e)}")  # Debug
        raise HTTPException(status_code=500, detail=f"db error: {str(e)}")