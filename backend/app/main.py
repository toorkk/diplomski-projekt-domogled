from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import fill_deduplicated_tables, get_del_stavbe_details, ingest_data, ingest_energetske_izkaznice, get_del_stavbe_geojson, get_cluster_del_stavbe, posodobi_statistike, splosne_statistike, vse_statistike

app = FastAPI(
    title="Domogled API",
    description="API za spletno stran Domogled, vnos podatkov in geojson plast ki grupira dele stavb (najemne ali kupoprodajne)",
    version="0.1.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",                    # Lokalno
        "https://domogled.vercel.app",      # Production
        "https://*.vercel.app"                     # Vercel previews
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

app.get("/properties/geojson")(get_del_stavbe_geojson)
app.get("/property-details/{deduplicated_id}")(get_del_stavbe_details)
app.get("/cluster/{cluster_id}/properties")(get_cluster_del_stavbe)


###############

@app.get("/")
def root():
    return {"message": "Domogled API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)