DROP MATERIALIZED VIEW IF EXISTS stats.mv_prodajne_statistike;
CREATE MATERIALIZED VIEW stats.mv_prodajne_statistike AS
WITH prodajni_podatki AS (
    SELECT 
        k.obcina,
        k.ime_ko,
        k.tip_nepremicnine,
        k.leto,
        
        -- Cene
        CASE 
            WHEN COALESCE( k.povrsina_uradna, k.povrsina_pogodba) > 0 
            THEN kp.cena / COALESCE( k.povrsina_uradna, k.povrsina_pogodba)
            ELSE NULL 
        END as cena_m2,
        kp.cena as skupna_cena,
        
        -- Velikost
        COALESCE(k.povrsina_uradna, k.povrsina_pogodba) as povrsina,
        
        -- Starost
        CASE 
            WHEN k.leto_izgradnje_stavbe IS NOT NULL THEN k.leto - k.leto_izgradnje_stavbe
            ELSE NULL
        END as starost_stavbe,
        
        kp.datum_sklenitve,
        EXTRACT(YEAR FROM kp.datum_sklenitve) as leto_posla,
        
        -- Agencija
        CASE WHEN kp.posredovanje_agencije = true THEN 1 ELSE 0 END as je_agencijska
        
    FROM core.kpp_del_stavbe k
    JOIN core.kpp_posel kp ON k.posel_id = kp.posel_id
    WHERE kp.cena IS NOT NULL 
      AND kp.cena > 0
      AND COALESCE(k.povrsina_uradna, k.povrsina_pogodba) IS NOT NULL 
      AND COALESCE(k.povrsina_uradna, k.povrsina_pogodba) > 0
      AND kp.trznost_posla = 1 -- samo tržni posli
      AND k.ime_ko IS NOT NULL
      AND k.obcina IS NOT NULL
)

-- NIVO 1: Statistike po KO (agregirano samo po ime_ko)
SELECT 
    NULL as obcina,  -- NULL ker je agregirano čez več občin (KO je lahko v več občinah)
    ime_ko,
    tip_nepremicnine,
    leto_posla as leto,
    
    -- Cenovni podatki m2
    AVG(cena_m2) as povprecna_cena_m2,
    PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY cena_m2) as p10_cena_m2,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY cena_m2) as p90_cena_m2,
    
    -- Skupne cene
    AVG(skupna_cena) as povprecna_skupna_cena,
    PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY skupna_cena) as p10_skupna_cena,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY skupna_cena) as p90_skupna_cena,
    
    -- Velikosti
    AVG(povrsina) as povprecna_velikost_m2,
    PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY povrsina) as p10_velikost_m2,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY povrsina) as p90_velikost_m2,
    
    -- Starost
    AVG(starost_stavbe) as povprecna_starost_stavbe,
    PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY starost_stavbe) as p10_starost_stavbe,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY starost_stavbe) as p90_starost_stavbe,
    
    -- Agencijske vs zasebne
    AVG(je_agencijska::numeric) * 100 as delez_agencijskih_pct,
    
    COUNT(*) as stevilo_poslov
    
FROM prodajni_podatki
WHERE tip_nepremicnine IN ('stanovanje', 'hisa')
GROUP BY ime_ko, tip_nepremicnine, leto_posla

UNION ALL

-- NIVO 2: Agregirane statistike po OBČINAH (agregirano samo po obcina)
SELECT 
    obcina,
    NULL as ime_ko,  -- NULL ker gledamo samo občine
    tip_nepremicnine,
    leto_posla as leto,
    
    AVG(cena_m2) as povprecna_cena_m2,
    PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY cena_m2) as p10_cena_m2,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY cena_m2) as p90_cena_m2,
    
    AVG(skupna_cena) as povprecna_skupna_cena,
    PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY skupna_cena) as p10_skupna_cena,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY skupna_cena) as p90_skupna_cena,
    
    AVG(povrsina) as povprecna_velikost_m2,
    PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY povrsina) as p10_velikost_m2,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY povrsina) as p90_velikost_m2,
    
    AVG(starost_stavbe) as povprecna_starost_stavbe,
    PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY starost_stavbe) as p10_starost_stavbe,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY starost_stavbe) as p90_starost_stavbe,
    
    AVG(je_agencijska::numeric) * 100 as delez_agencijskih_pct,
    COUNT(*) as stevilo_poslov
    
FROM prodajni_podatki
WHERE tip_nepremicnine IN ('stanovanje', 'hisa')
GROUP BY obcina, tip_nepremicnine, leto_posla;  -- Samo po obcina, brez ime_ko

-- Indeksi za materialized view
CREATE INDEX idx_mv_prodajne_regija_leto ON stats.mv_prodajne_statistike(obcina, tip_nepremicnine, leto);
CREATE INDEX idx_mv_prodajne_ko_leto ON stats.mv_prodajne_statistike(ime_ko, tip_nepremicnine, leto);
CREATE INDEX idx_mv_prodajne_tip ON stats.mv_prodajne_statistike(tip_nepremicnine);