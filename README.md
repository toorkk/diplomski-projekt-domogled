# domogled.si
Ekipa Ptujčana, razvoj spletne strani za vizualizacijo in analizo nepremičninskega trga v Sloveniji.

Rešitev je dostopna na naslednji domeni:
[domogled.si](https://domogled.si/).

------------------------

## Setup

### Baza

PostgreSQL baza z PostGIS se namesti z Docke containerjem.


Proces namestitve iz root direktorija je naslednji:

```
cd .\db\
docker compose build
docker-compose up -d
```

v db/commands.txt se nahajajo ukazi za kreacijo vseh potrebnih tabel baze, razdeljene na 6 dokumentov. Zagnati jih je potrebno v /db direktoriju

Ukazi so:
```
Get-Content sql/01_create_database.sql | docker exec -i domogled-db psql -U postgres -d domogled
Get-Content sql/02_np_staging_schema.sql | docker exec -i domogled-db psql -U postgres -d domogled
Get-Content sql/03_kpp_staging_schema.sql | docker exec -i domogled-db psql -U postgres -d domogled
Get-Content sql/04_ei_staging_schema.sql | docker exec -i domogled-db psql -U postgres -d domogled
Get-Content sql/05_core_schema.sql | docker exec -i domogled-db psql -U postgres -d domogled
Get-Content sql/06_stats_schema.sql | docker exec -i domogled-db psql -U postgres -d domogled
```

za ponovni zagon sta potrebna samo naslednja ukaza:
```
cd .\db\
docker-compose up -d
```

### Backend
FastAPI backend. Temelji na Python-u, potrebem vsaj Python 3.8


Za vspostavitev je potrebno zagnati naslednje ukaze iz root direktorija:
```
cd .\backend\
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

po kreaciji virtual enviornment-a (python -m venv venv), se mora prikazati "(venv)" v zacetku vsake vrstice terminala. če ga želiš onemogočiti je komanda "deactivate"

Za ponovni zagon so potrebni samo naslednji ukazi:
```
cd .\backend\
.\venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload
```

### Frontend
Frontend temelji na React + Vite v jeziku JavaScript


Za vspostavitev je potrebno zagnati naslednje ukaze iz root direktorija:
```
cd .\frontend\
npm install
npm run dev
```

za ponovni zagon sta potrebna samo naslednja ukaza:
```
cd .\frontend\
npm run dev
```

------------------------

## Domogled API

### Vnos podatkov

Za avtomatski vnos, filtriranje in transformacijo podatkov v tabele baze so na voljo naslednji API endpoint-i:


- vnos vseh delov stavb in poslov
```
POST /api/deli-stavb/ingest
POST /api/deli-stavb/ingest?data_type=np
POST /api/deli-stavb/ingest?data_type=kpp
```
-- tu zraven se lahko das start_year in end_year
   
- vnos energetskih izkaznic
```
POST /api/energetske-izkaznice/ingest
```

- vnos dedupliciranih podatkov za prikaz nepremičnin na zemljevidu, pridobljene iz tabel za dele stavb, poslov in tabele energetskih izkaznic
```
POST /api/deduplication/ingest
```

- vnos statističnih podatkov, pridobljene iz tabel za dele stavb in poslov
```
POST /api/statistike/posodobi
```


definicije vseh endpointov so ldostopne na http://localhost:8000/docs, po tem ko je zagnan FastAPI backend strežnik.
