# diplomski-projekt
Ekipa Ptujčana, razvoj spletne strani za vizualizacijo in analizo nepremičninskega trga: Domogled


# setup

DOCKER:
v mapi db

docker compose build
docker-compose up -d

prvič laufal:
za tem pojdi v sql commands.txt in zaženi kaj je not

-------------------------
BACKEND:
v mapi backend

ustvari virtual enviornment:
python -m venv venv

spodnja komanda aktivira virtual enviornment:
.\venv\Scripts\Activate.ps1
(moralo bi pokazati "(venv)" v zacetku vsake vrstice terminala. če ga želiš disablat je komanda "deactivate")



pip install -r requirements.txt

preveri če dela:
uvicorn --version

zaženi:

.\venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload

------------------------
FRONTEND:
v mapi frontend

npm install

npm run dev	

ce si v vs code installiraj Tailwind CSS IntelliSense plugin
------------------------
DATA INGESTION:

POST call 

POST /api/ingest-data?data_type=np&start_year=2013&end_year=2025
POST /api/ingest-data?data_type=kpp&start_year=2007&end_year=2025

definicije vseh endpointov si lahko pogledas v http://localhost:8000/docs
