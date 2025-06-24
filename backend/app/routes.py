import os
from fastapi import Depends, HTTPException, Path, Query, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from .database import get_db, DATABASE_URL
from .zemljevid_service import DelStavbeService
from .data_ingestion import DataIngestionService
from .deduplication import DeduplicationService
from .energetska_izkaznica_ingestion import EnergetskaIzkaznicaIngestionService
from .statistics_service import StatisticsService


ingestion_service = DataIngestionService(DATABASE_URL)

deduplication_service = DeduplicationService(DATABASE_URL)

ei_ingestion_service = EnergetskaIzkaznicaIngestionService(DATABASE_URL)

stats_service = StatisticsService(DATABASE_URL)


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
                    "endpoint": "/api/deduplication/ingest",
                    "note": "Deduplication gre skozi vse leta in se more zagnat po tem ko je vnos podatkov ČISTO končan. Reflektiral bo samo leta ki so trenutno naložena v bazo"
                }
            }
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(e)}
        )


async def fill_deduplicated_tables(
    background_tasks: BackgroundTasks,
    data_type: str = Query(None, description="Tip podatkov (np, kpp, ali vsi za np + kpp)")
):
    """
    API endpoint za ustvarjanje deduplicirane tabele po končanem vnosu podatkov.
    Zaženi to ENKRAT po tem, ko so vsi podatki za vsa leta vnešeni.
    """
    try:
        if data_type and data_type.lower() not in ["np", "kpp", "vsi"]:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Data type mora biti 'np', 'kpp' ali 'vsi' za np + kpp"}
            )

        if data_type is None or data_type.lower() == "vsi":
            # Obdelaj oba tipa podatkov
            background_tasks.add_task(
                deduplication_service.create_all_deduplicated_del_stavbe,
                ["np", "kpp"]
            )
            message = "Dedupliciranje se je začelo za podatke NP in KPP"
        else:
            # Obdelaj en tip podatkov
            background_tasks.add_task(
                deduplication_service.create_deduplicated_del_stavbe,
                data_type.lower()
            )
            message = f"Dedupliciranje se je začelo za podatke {data_type.upper()}"

        return JSONResponse(
            status_code=202,
            content={
                "status": "accepted",
                "message": message,
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


# =============================================================================
# DEL STAVBE ENDPOINTI
# =============================================================================

def get_del_stavbe_geojson(
    bbox: str = Query(..., description="Bounding box 'west,south,east,north'"),
    zoom: float = Query(default=10, description="Zoom level za clustering"),
    data_source: str = Query(default="np", description="Data source: 'np' za najemne 'kpp' za kupoprodajne"),
    municipality: str = Query(None, description="Filter po občini (opcijsko)"),  
    sifko: int = Query(None, description="Filter po šifri katastrske občine (opcijsko)"),

    filter_leto: int = Query(None, description="Filter po letu posla (opcijsko)"),
    min_cena: float = Query(None, description="Minimalna cena/najemnina (opcijsko)"),
    max_cena: float = Query(None, description="Maksimalna cena/najemnina (opcijsko)"),
    min_povrsina: float = Query(None, description="Minimalna površina (opcijsko)"),
    max_povrsina: float = Query(None, description="Maksimalna površina (opcijsko)"),

    db: Session = Depends(get_db)
):
    """
    Pridobi dele stavb trenutno vidne na ekranu:
    - DEPRECATED: Če je podan sifko/municipality: Vrni VSE nepremičnine v tej občini (ignore bbox, samo building clustering)
    - VEDNO: Uporabi bbox z distance/building clustering
    
    Parameter data_source omogoča preklapljanje med različnimi viri podatkov:
    - 'np': najemni podatki (np_del_stavbe)
    - 'kpp': kupoprodajni podatki (kpp_del_stavbe)
    """
    try:

        if data_source.lower() not in ["np", "kpp"]:
            raise ValueError("data_source mora bit 'np' ali 'kpp'")
            
        west, south, east, north = map(float, bbox.split(','))

        filters = {}
        if filter_leto is not None:
            filters['filter_leto'] = int(filter_leto)
        if min_cena is not None:
            filters['min_cena'] = float(min_cena)
        if max_cena is not None:
            filters['max_cena'] = float(max_cena)
        if min_povrsina is not None:
            filters['min_povrsina'] = float(min_povrsina)
        if max_povrsina is not None:
            filters['max_povrsina'] = float(max_povrsina)

        # Debug logging
        if filters:
            print(f"Active filters: {filters}")
        else:
            print("No filters applied")
        
        
        cluster_threshold = 14.5
        
        if zoom >= cluster_threshold:
            return DelStavbeService.get_building_clustered_del_stavbe(west, south, east, north, db, data_source, filters)
        else:
            return DelStavbeService.get_distance_clustered_del_stavbe(west, south, east, north, zoom, db, data_source, filters)
            
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"neveljavni parametri: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"db error: {str(e)}")
    

def get_del_stavbe_details(
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
        
        del_stavbe_details = DelStavbeService.get_del_stavbe_details(deduplicated_id, data_source, db)
        
        if not del_stavbe_details:
            raise HTTPException(status_code=404, detail="Del stavbe ni bil najden")
        
        return del_stavbe_details
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"neveljavni parametri: {str(e)}")
    except HTTPException:
        raise # Re-raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"db error: {str(e)}")
    
    
# =============================================================================
# CLUSTER ENDPOINTI  
# =============================================================================

def get_cluster_del_stavbe(
    cluster_id: str,
    data_source: str = Query(default="np", description="Data source: 'np' za najemne 'kpp' za kupoprodajne"),
    filter_leto: int = Query(None, description="Filter po letu posla (opcijsko)"),
    min_cena: float = Query(None, description="Minimalna cena/najemnina (opcijsko)"),
    max_cena: float = Query(None, description="Maksimalna cena/najemnina (opcijsko)"),
    min_povrsina: float = Query(None, description="Minimalna površina (opcijsko)"),
    max_povrsina: float = Query(None, description="Maksimalna površina (opcijsko)"),
    db: Session = Depends(get_db)
):
    """
    Pridobi vse nepremičnine ki spadajo pod določen building cluster
    """
    try:
        
        if data_source.lower() not in ["np", "kpp"]:
            raise ValueError("data_source mora bit 'np' ali 'kpp'")

        filters = {}
        if filter_leto is not None:
            filters['filter_leto'] = int(filter_leto)
        if min_cena is not None:
            filters['min_cena'] = float(min_cena)
        if max_cena is not None:
            filters['max_cena'] = float(max_cena)
        if min_povrsina is not None:
            filters['min_povrsina'] = float(min_povrsina)
        if max_povrsina is not None:
            filters['max_povrsina'] = float(max_povrsina)
        

        # Podporni samo Building cluster: b_obcina_sifra_ko_stevilka_stavbe
        if cluster_id.startswith('b_'):

            parts = cluster_id[2:].split('_')
            
            if len(parts) >= 3:  # Spremenil iz 2 na 3 (obcina + sifra_ko + stevilka_stavbe)
                obcina = parts[0]
                sifra_ko = int(parts[1])
                stevilka_stavbe = int(parts[2])                

                return DelStavbeService.get_stavba_multicluster(obcina, sifra_ko, stevilka_stavbe, db, data_source, filters)
                

        elif cluster_id.startswith('d_'):
            # Distance clustri niso podprti za expansion
            raise ValueError("Distance clustri ne podpirajo expansion funkcionalnosti")
        
        else:
            raise ValueError(f"Nepodprt tip clusterja: {cluster_id}")
            
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"neveljavni parametri: {str(e)}")
    except Exception as e:
        print(f"Error v get_cluster_del_stavbe: {str(e)}")
        raise HTTPException(status_code=500, detail=f"db error: {str(e)}")
    

# =============================================================================
# STATISTIKE ENDPOINTI
# =============================================================================

async def posodobi_statistike(background_tasks: BackgroundTasks):
    """
    Napolni/posodobi VSE statistike
    
    Primer uporabe:
    - POST /api/statistike/posodobi
    """
    try:
        background_tasks.add_task(
            stats_service.refresh_all_statistics
        )
        
        return JSONResponse(
            status_code=202,
            content={
                "status": "sprejeto",
                "sporocilo": "Posodabljanje vseh statistik se je začelo",
                "regije": "vse",
                "opomba": "Preveri status z GET /api/statistike/status"
            }
        )
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"status": "napaka", "sporocilo": str(e)}
        )


def vse_statistike(
    tip_regije: str = Path(..., description="Tip regije: 'obcina', 'katastrska_obcina', 'slovenija'"),
    regija: str = Path(..., description="Ime regije (občina/KO/slovenia)")
):
    """
    Pridobi VSE statistike za določeno obcino/KO/slovenijo
    
    Vrne vse statistike organizirane po:
    - prodaja/najem
    - stanovanja/hiše  
    - letni podatki + zadnjih 12 mesecev
    - vse lastnosti
    
    Primer uporabe:
    - GET /api/statistike/vse/tip_regije/IME REGIJE
    - GET /api/statistike/vse/obcina/LJUBLJANA
    - GET /api/statistike/vse/slovenia/SLOVENIJA
    """
    try:
        # Validiraj tip regije
        veljavni_tipi = ["obcina", "katastrska_obcina", "slovenija"]
        if tip_regije not in veljavni_tipi:
            raise ValueError(f"tip_regije mora biti eden od: {', '.join(veljavni_tipi)}")
        
        # Pridobi vse statistike
        rezultat = stats_service.get_full_statistics(regija, tip_regije)
        
        if rezultat["status"] == "error":
            raise HTTPException(status_code=404, detail=rezultat["message"])
        
        return JSONResponse(
            status_code=200,
            content=rezultat
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Neveljavni parametri: {str(e)}")
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB napaka: {str(e)}")


def splosne_statistike(
    tip_regije: str = Path(..., description="Tip regije: 'obcina', 'katastrska_obcina', 'slovenija'"),
    regija: str = Path(..., description="Ime regije")
):
    """
    Pridobi samo splosne/ključne statistike za regijo
    
    Vrne samo osnovne statistike za zadnjih 12 mesecev:
    - povprečne cene
    - število poslov
    - povprečne velikosti
    - povprečne starosti
    
    Primer uporabe:
    - GET /api/statistike/splosne/LJUBLJANA
    - GET /api/statistike/splosne/LJUBLJANA?tip_regije=obcina
    - GET /api/statistike/splosne/slovenia?tip_regije=slovenija
    """
    try:
        # Validiraj tip regije
        veljavni_tipi = ["obcina", "katastrska_obcina", "slovenija"]
        if tip_regije not in veljavni_tipi:
            raise ValueError(f"tip_regije mora biti eden od: {', '.join(veljavni_tipi)}")
        
        # Pridobi splošne statistike
        rezultat = stats_service.get_general_statistics(regija, tip_regije)
        
        if rezultat["status"] == "error":
            raise HTTPException(status_code=404, detail=rezultat["message"])
        
        return JSONResponse(
            status_code=200,
            content=rezultat
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Neveljavni parametri: {str(e)}")
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB napaka: {str(e)}")
    
def vse_obcine_posli_zadnjih_12m(
    vkljuci_katastrske: bool = Query(
        default=True, 
        description="Ali naj vključi tudi katastrske občine"
    )
):
    """
    Pridobi število poslov za zadnjih 12 mesecev za VSE občine + opcijsko katastrske občine
    """
    try:
        # Pokliči posodobljeno metodo
        rezultat = stats_service.get_all_obcine_posli_zadnjih_12m(vkljuci_katastrske=vkljuci_katastrske)
        
        if rezultat["status"] == "error":
            raise HTTPException(status_code=404, detail=rezultat["message"])
        
        return JSONResponse(
            status_code=200,
            content=rezultat
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB napaka: {str(e)}")