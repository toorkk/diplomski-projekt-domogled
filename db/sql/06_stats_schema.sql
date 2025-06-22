CREATE SCHEMA IF NOT EXISTS stats;

DROP MATERIALIZED VIEW IF EXISTS stats.mv_najemne_statistike CASCADE;
DROP MATERIALIZED VIEW IF EXISTS stats.mv_prodajne_statistike CASCADE;

DROP TABLE IF EXISTS stats.statistike_cache CASCADE;
CREATE TABLE stats.statistike_cache (
    id SERIAL PRIMARY KEY,
    
    tip_regije VARCHAR(20) NOT NULL, -- 'obcina', 'katastrska_obcina', 'slovenija'
    ime_regije VARCHAR(100) NOT NULL, -- ime občine/KO ali 'Slovenija'
    vrsta_nepremicnine VARCHAR(20) NOT NULL, -- 'stanovanje', 'hisa'
    tip_posla VARCHAR(10) NOT NULL, -- 'prodaja', 'najem'
    tip_obdobja VARCHAR(15) NOT NULL, -- 'letno', 'zadnjih12m'
    leto INTEGER, -- NULL za zadnjih12m
    
    -- OSNOVNE CENE/NAJEMNINE
    povprecna_cena_m2 FLOAT,
    povprecna_skupna_cena FLOAT,
    
    -- OSNOVNE STATISTIKE
    stevilo_poslov INTEGER DEFAULT 0,
    aktivna_v_letu INTEGER DEFAULT 0, -- samo za najem
    povprecna_velikost_m2 FLOAT,  -- uporabna povrsina
    povprecna_starost_stavbe FLOAT,
    
    -- COUNT STATISTIKE (koliko validnih podatkov za vsako metriko)
    cena_m2_count INTEGER DEFAULT 0,
    skupna_cena_count INTEGER DEFAULT 0,
    velikost_m2_count INTEGER DEFAULT 0,
    starost_stavbe_count INTEGER DEFAULT 0,
        
    CONSTRAINT uq_statistike_cache UNIQUE(tip_regije, ime_regije, vrsta_nepremicnine, tip_posla, tip_obdobja, leto)
);

-- Indeksi
CREATE INDEX idx_statistike_cache_iskanje ON stats.statistike_cache(tip_regije, ime_regije, vrsta_nepremicnine, tip_posla, tip_obdobja);
CREATE INDEX idx_statistike_cache_regija ON stats.statistike_cache(ime_regije);
CREATE INDEX idx_statistike_cache_obdobje ON stats.statistike_cache(tip_obdobja, leto);
CREATE INDEX idx_statistike_cache_tip_posla ON stats.statistike_cache(tip_posla);