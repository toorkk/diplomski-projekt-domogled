# diplomski-projekt
Ekipa Ptujčana, razvoj spletne strani za vizualizacijo in analizo nepremičninskega trga: Domogled


# setup

DOCKER:

docker-compose up -d

-------------------------
BACKEND:

cd backend

ustvari virtual enviornment:
python -m venv venv

spodnja komanda aktivira virtual enviornment:
.\venv\Scripts\Activate.ps1
(moralo bi pokazati "(venv)" v zacetku vsake vrstice terminala. če ga želiš disablat je komanda "deactivate")



pip install -r requirements.txt

preveri če dela:
uvicorn --version

zaženi:

python -m uvicorn app.main:app --reload

------------------------
FRONTEND:

moras bit v mapi frontend

npm install

npm run dev	

ce si v vs code installiraj Tailwind CSS IntelliSense plugin
------------------------