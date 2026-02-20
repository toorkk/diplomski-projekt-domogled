from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

import pytz
from apscheduler.triggers.cron import CronTrigger
from .scheduler import scheduler, weekly_update

from .routes import (
    fill_deduplicated_tables,
    get_podobne_nepremicnine, 
    ingest_data, 
    ingest_energetske_izkaznice, 
    posodobi_statistike, 
    splosne_statistike, 
    vse_obcine_posli_zadnjih_12m,
    vse_obcine_cene_m2_zadnjih_12m,  
    vse_statistike, 
    get_del_stavbe_geojson, 
    get_cluster_del_stavbe, 
    get_del_stavbe_details
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(
        weekly_update,
        trigger=CronTrigger(day_of_week="fri", hour=20, minute=0, timezone=pytz.timezone("Europe/Ljubljana")),
        id="weekly_update",
        replace_existing=True,
    )
    scheduler.start()
    yield
    scheduler.shutdown()

app = FastAPI(
    title="Domogled API",
    description="API za spletno stran Domogled, vnos podatkov in geojson plast ki grupira dele stavb (najemne ali kupoprodajne)",
    version="0.1.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",                   # Lokalno
        "https://domogled.si",
        "https://www.domogled.si",                 # Production
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# registriraj endpointe
############

app.post("/api/deli-stavb/ingest")(ingest_data)

app.post("/api/deduplication/ingest")(fill_deduplicated_tables)

app.post("/api/energetske-izkaznice/ingest")(ingest_energetske_izkaznice)

app.post("/api/statistike/posodobi")(posodobi_statistike)

app.get("/api/statistike/vse/{tip_regije}/{regija}")(vse_statistike)
app.get("/api/statistike/splosne/{tip_regije}/{regija}")(splosne_statistike)
app.get("/api/statistike/vse-obcine-posli-zadnjih-12m")(vse_obcine_posli_zadnjih_12m)
app.get("/api/statistike/vse-obcine-cene-m2-zadnjih-12m")(vse_obcine_cene_m2_zadnjih_12m)  

app.get("/properties/geojson")(get_del_stavbe_geojson)
app.get("/property-details/{deduplicated_id}")(get_del_stavbe_details)
app.get("/cluster/{cluster_id}/properties")(get_cluster_del_stavbe)

app.get("/property/{deduplicated_id}/similar")(get_podobne_nepremicnine)


###############

@app.get("/")
def root():
    return {"message": "Domogled API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)