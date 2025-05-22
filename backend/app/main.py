from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import ingest_data, ingestion_status, get_properties_geojson

app = FastAPI(
    title="Domogled API",
    description="API za spletno stran Domogled, vnos podatkov in geojson plast ki grupira dele stavb (najemne ali kupoprodajne)",
    version="0.1.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# registriraj endpointe
############

app.post("/api/ingest-data")(ingest_data)
app.get("/api/ingestion-status")(ingestion_status)
app.get("/properties/geojson")(get_properties_geojson)

###############

@app.get("/")
def root():
    return {"message": "Domogled API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)