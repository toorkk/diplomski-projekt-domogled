# Domogled.si 

<br />
<div align="center">
  <img src="https://github.com/user-attachments/assets/0d124197-4ab5-4a4d-b9db-c4bb0b2a8282" alt="domogled-header" width="300">
</div>
<br />

Domogled je spletna rešitev za analizo slovenskega nepremičninskega trga, ki omogoča interaktiven pregled nad prodajnimi in oddajnimi posli nepremičnin v Sloveniji. Aplikacija ponuja vizualizacijo podatkov na zemljevidu ter statistične analize, namenjene je primarno posameznikom, ki iščejo vpogled v trenutno stanje in trende nepremičninskega trga.

<br />

Rešitev je dostopna na naslednji domeni: [domogled.si](https://www.domogled.si/).

<br />

Domogled sma razvila [Anže Hameršak](https://github.com/toorkk) in [Vasja Rimele](https://github.com/vaskolinko) kot del Zaključnega diplomskega projekta

## Kazalo

- [Pregled projekta](#pregled-projekta)
  - [Nepremičninski zemljevid](#nepremičninski-zemljevid)
  - [Statistični zemljevid](#statistični-zemljevid)
- [Viri podatkov](#viri-podatkov)
- [Struktura podatkov](#struktura-podatkov)
- [Arhitektura](#arhitektura)
- [Namestitev in zagon](#namestitev-in-zagon)
  - [Predpogoji](#predpogoji)
  - [1. Podatkovna baza](#1-podatkovna-baza)
  - [2. Zaledni sistem](#2-zaledni-sistem)
  - [3. Uporabniški vmesnik](#3-uporabniški-vmesnik)
- [Domogled API](#domogled-api)
  - [Vnos podatkov](#vnos-podatkov)
  - [Pridobivanje podatkov](#pridobivanje-podatkov)

------------------------

## Pregled projekta
Spletna rešitev je sestavljena iz dveh glavnih delov. Nepremičninski zemljevid in Statistični zemljevid.

### Nepremičninski zemljevid

Glavne funkcionalnosti:
- Vizualizacija individualnih nepremičninskih poslov, deljene na kupoprodajne in najemne posle.
- Filtriranje poslov glede na: leto sklenitve, ceno/najemnino in uporabno površino nepremičnine.
- Splošne statistike občine, deljene na hiše/stanovanja (ter katastrske občine Ljubljane in Maribora), za zadnjih 12 mesecev.
- Podroben prikaz informacij o prodani/oddani nepremičnini, ki vključuje: 
pretekle posle, karakteristike nepremičnine za določen posel (spreminjane karakteristik med različnimi posli), energetska izkaznica dela stavbe/stavbe, dodatni deli stavb vključeni v nepremičninski posel.

![domogled-1](https://github.com/user-attachments/assets/c9230c6f-80b8-4344-8320-c7a1dab2585c)
![domogled-2](https://github.com/user-attachments/assets/ab9862ac-951f-4b4e-a642-b9e071171baa)
![domogled-3](https://github.com/user-attachments/assets/3d235345-285f-4542-8e45-5c7219b01d18)


### Statistični zemljevid

Glavne funkcionalnosti ki so na razpolago za vsako občino (tudi katastrske občine Ljubljane in Maribora), deljene na prodajne/najemne informacije:
- Vizualizacija povprečne cene/m² in število poslov na zemljevidu.
- Prikaz splošnih statistik za zadnjih 12 mesecev deljene na hiše/stanovanja ki vključuje: število poslov, povp. cena/m², povprečna celotna cena, povp. uporabna površina, povp. starost stavbe.
- Prikaz statističnih trendov skozi leta, deljene na hiše/stanovanja ki vključuje enake informacije kot statistike za zadnjih 12 mesecev.
- Statistike za celotno Slovenijo

![domogled-4](https://github.com/user-attachments/assets/c17ca47e-d6d6-4f91-9418-cad183387513)
![domogled-5](https://github.com/user-attachments/assets/97b616f2-fb91-43cc-8486-ac726f4f4e30)

------------------------

## Viri podatkov

Podatki, kateri so javne narave, so pridobljeni iz naslednjih virov:
- Informacije o prodajnih in najemnih poslih ter podatki o delih stavb: [Javni Geodetski Podatki](https://ipi.eprostor.gov.si/jgp/data)
- Informacije o energetskih izkaznicah za posamezne stavbe in dele stavb: [Register Energetskih Izkaznic](https://www.energetika-portal.si/podrocja/energetika/energetske-izkaznice-stavb/register-energetskih-izkaznic/)

------------------------

## Struktura podatkov


![ER-diagram](https://github.com/user-attachments/assets/6efb059d-2260-44bb-859f-8135f28ba6e9)


------------------------

## Arhitektura

Spletna rešitev je zgrajena iz treh delov: Vite + React frontend, FastAPI backend in PostgreSQL + PostGIS podatkovna baza

Struktura projekta je naslednja:
```
├── backend/        <-- FastAPI
├── frontend/       <-- Vite + React
├── db/             <-- PostgreSQL + PostGIS
├── dokumentacija/  <-- diagrami
└── README.md
```

------------------------

## Namestitev in zagon

### Predpogoji
- Python 3.8 ali novejši
- Node.js 16 ali novejši
- Docker
- Git


### 1. Podatkovna baza

PostgreSQL baza z PostGIS se namesti z Docker containerjem.

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

### 2. Zaledni sistem
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

### 3. Uporabniški vmesnik
Frontend temelji na Vite + React v JavaScript-u


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

Backend API je dostopen na http://localhost:8000

Dodatna dokumentacija je po zagonu backend strežnika tudi na voljo na:

Swagger UI: http://localhost:8000/docs

ReDoc: http://localhost:8000/redoc

### Vnos podatkov

Za avtomatski vnos, filtriranje in transformacijo podatkov v tabele baze so na voljo naslednji API endpoint-i:


- vnos vseh delov stavb in poslov
```
POST /api/deli-stavb/ingest
```
   
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

### Pridobivanje podatkov

Za pridobivanje podatkov spletna rešitev uporablja naslednje endpoint-e:

- pridobivanje geoJSON datoteke za prikaz posameznih prodanih/oddanih nepremičnin na zemljevidu v določenem viewbox-u (trenutno viden del zemljevida), avtomatsko grupira po oddaljenosti/stavbah v cluster-je glede na zoom level
```
GET /properties/geojson
```

- pridobivanje osnovnih podatkov o vseh nepremičninah za določen cluster (samo za cluster-je ki grupirajo po stavbah)
```
GET /cluster/{cluster_id}/properties
```

- pridobivanje podrobnih informacij (vsi relevanti deli stavb, posli, energetske izkaznice) za izbrano nepremičnino na zemljevidu
```
GET /property-details/{deduplicated_id}
```

- pridobivanje podrobnih statistik za Slovenijo/občino/katastrsko občino za prikaz v statističnem zemljevidu
```
GET /api/statistike/vse/{tip_regije}/{regija}
```

- pridobivanje splošnih statistik za občino/katastrsko občino za prikaz v nepremičninskem zemljevidu
```
GET /api/statistike/splosne/{tip_regije}/{regija}
```

- pridobivanje statistik o stevilu poslov za vse občine/katastrske občine za prikaz na statističnem zemljevidu
```
GET /api/statistike/vse-obcine-posli-zadnjih-12m
```

- pridobivanje statistik o ceni/m² za vse občine/katastrske občine za prikaz na statističnem zemljevidu
```
GET /api/statistike/vse-obcine-cene-m2-zadnjih-12m
```
