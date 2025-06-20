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


POST /api/deli-stavb/ingest?data_type=np   -- tu zraven se lahko das start_year in end_year
POST /api/deli-stavb/ingest?data_type=kpp
GET /api/deli-stavb/status

POST /api/energetske-izkaznice/ingest
GET  /api/energetske-izkaznice/status

POST /api/deduplication/ingest
GET /api/deduplication/status

definicije vseh endpointov si lahko pogledas v http://localhost:8000/docs


STATISTIKA:

prodajna:
- začne se v letu 2007

najemna: