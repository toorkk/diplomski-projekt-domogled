from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import deduplication_status, fill_deduplicated_tables, get_property_details, ingest_data, ingestion_status, get_properties_geojson, get_cluster_properties

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

app.post("/api/fill-deduplicated-tables")(fill_deduplicated_tables)
app.get("/api/deduplicated-status")(deduplication_status)

app.get("/properties/geojson")(get_properties_geojson)
app.get("/property-details/{deduplicated_id}")(get_property_details)

app.get("/cluster/{cluster_id}/properties")(get_cluster_properties)


###############

@app.get("/")
def root():
    return {"message": "Domogled API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)