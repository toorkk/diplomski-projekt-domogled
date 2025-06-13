CREATE SCHEMA IF NOT EXISTS stats;

DROP TABLE IF EXISTS stats.statistike_cache CASCADE;
CREATE TABLE stats.statistike_cache (
    id SERIAL PRIMARY KEY,
    
    tip_regije VARCHAR(20) NOT NULL, -- 'obcina', 'katastrska_obcina', 'slovenija'
    ime_regije VARCHAR(100) NOT NULL, -- ime občine/KO ali 'slovenija'
    tip_nepremicnine VARCHAR(20) NOT NULL, -- 'stanovanje', 'hisa'
    tip_posla VARCHAR(10) NOT NULL, -- 'prodaja', 'najem'
    tip_obdobja VARCHAR(15) NOT NULL, -- 'letno', 'zadnjih_12m'
    leto INTEGER, -- NULL za zadnjih_12m
    
    povprecna_cena_m2 DECIMAL(10,2),
    percentil_10_cena_m2 DECIMAL(10,2),
    percentil_90_cena_m2 DECIMAL(10,2),
    
    povprecna_skupna_cena DECIMAL(12,2),
    percentil_10_skupna_cena DECIMAL(12,2),
    percentil_90_skupna_cena DECIMAL(12,2),
    
    stevilo_poslov INTEGER DEFAULT 0,
    trenutno_v_najemu INTEGER DEFAULT 0, -- samo za najem
    
    povprecna_velikost_m2 DECIMAL(10,2),
    percentil_10_velikost_m2 DECIMAL(9,2),
    percentil_90_velikost_m2 DECIMAL(12,2),
    
    povprecna_starost_stavbe INTEGER,
    percentil_10_starost_stavbe INTEGER,
    percentil_90_starost_stavbe INTEGER,
    
    delez_opremljenih_pct DECIMAL(5,2), -- samo za najem
        
    CONSTRAINT uq_statistike_cache UNIQUE(tip_regije, ime_regije, tip_nepremicnine, tip_posla, tip_obdobja, leto)
);

-- Indeksi
CREATE INDEX idx_statistike_cache_iskanje ON stats.statistike_cache(tip_regije, ime_regije, tip_nepremicnine, tip_posla, tip_obdobja);
CREATE INDEX idx_statistike_cache_regija ON stats.statistike_cache(ime_regije);
CREATE INDEX idx_statistike_cache_obdobje ON stats.statistike_cache(tip_obdobja, leto);