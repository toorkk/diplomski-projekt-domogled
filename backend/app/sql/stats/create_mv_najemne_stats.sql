DROP MATERIALIZED VIEW IF EXISTS stats.mv_najemne_statistike;
CREATE MATERIALIZED VIEW stats.mv_najemne_statistike AS
WITH najemni_podatki AS (
    SELECT 
        n.obcina,
        n.ime_ko,
        n.vrsta_nepremicnine,
        
        -- Use n.leto as the definitive year
        n.leto as leto_posla,
        
        -- Cene
        CASE 
            WHEN COALESCE(n.povrsina_uradna, n.povrsina_pogodba) > 0 
            THEN np.najemnina / COALESCE(n.povrsina_uradna, n.povrsina_pogodba)
            ELSE NULL 
        END as najemnina_m2,
        np.najemnina as skupna_najemnina,
        
        -- Velikost
        COALESCE(n.povrsina_pogodba, n.povrsina_uradna) as povrsina,
        COALESCE(n.povrsina_uporabna_pogodba, n.povrsina_uporabna_uradna) as povrsina_uporabna,
        
        -- Starost - use n.leto for consistency
        CASE 
            WHEN n.leto_izgradnje_stavbe IS NOT NULL 
            THEN n.leto - n.leto_izgradnje_stavbe
            ELSE NULL
        END as starost_stavbe,
        
        -- Opremljenost
        CASE 
            WHEN n.opremljenost = 1 THEN 1 
            ELSE 0 
        END as je_opremljena,
        
        np.datum_sklenitve,
        np.datum_prenehanja_najemanja,
        
        -- Ali je trenutno aktivno
        CASE 
            WHEN (np.datum_prenehanja_najemanja IS NULL OR np.datum_prenehanja_najemanja > CURRENT_DATE)
                AND (np.datum_zakljucka_najema IS NULL OR np.datum_zakljucka_najema > CURRENT_DATE)
            THEN 1 ELSE 0 
        END as trenutno_aktivna
        
    FROM core.np_del_stavbe n
    JOIN core.np_posel np ON n.posel_id = np.posel_id
    WHERE np.najemnina IS NOT NULL 
      AND np.najemnina > 0
      AND Np.vrsta_posla IN (1,2) -- to treba premaknit in se samo uporabit za cene najema
      AND COALESCE(n.povrsina_uradna, n.povrsina_pogodba) IS NOT NULL 
      AND COALESCE(n.povrsina_uradna, n.povrsina_pogodba) > 0
      AND n.ime_ko IS NOT NULL
      AND n.obcina IS NOT NULL
      AND n.leto IS NOT NULL  -- Ensure we have valid years
      AND n.leto BETWEEN 2000 AND EXTRACT(YEAR FROM CURRENT_DATE)  -- Reasonable year range
)

-- NIVO 1: Statistike po KO (agregirano samo po ime_ko)
SELECT 
    NULL as obcina,  -- NULL ker je agregirano čez več občin
    ime_ko,
    vrsta_nepremicnine,
    leto_posla as leto,  -- This is now consistently n.leto
    
    -- Cenovni podatki m2
    AVG(najemnina_m2) as povprecna_najemnina_m2,
    PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY najemnina_m2) as p10_najemnina_m2,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY najemnina_m2) as p90_najemnina_m2,
    
    -- Skupne najemnine
    AVG(skupna_najemnina) as povprecna_skupna_najemnina,
    PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY skupna_najemnina) as p10_skupna_najemnina,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY skupna_najemnina) as p90_skupna_najemnina,
    
    -- Velikosti
    AVG(povrsina) as povprecna_velikost_m2,
    PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY povrsina) as p10_velikost_m2,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY povrsina) as p90_velikost_m2,
    
    -- Starost
    AVG(starost_stavbe) as povprecna_starost_stavbe,
    PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY starost_stavbe) as p10_starost_stavbe,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY starost_stavbe) as p90_starost_stavbe,
    
    -- Opremljenost
    AVG(je_opremljena::numeric) * 100 as delez_opremljenih_pct,
    
    COUNT(*) as stevilo_poslov,
    SUM(trenutno_aktivna) as trenutno_v_najemu
    
FROM najemni_podatki
WHERE vrsta_nepremicnine IN (1, 2)
GROUP BY ime_ko, vrsta_nepremicnine, leto_posla

UNION ALL

-- NIVO 2: Agregirane statistike po OBČINAH
SELECT 
    obcina,
    NULL as ime_ko,  -- NULL ker gledamo samo občine
    vrsta_nepremicnine,
    leto_posla as leto,  -- Consistent year field
    
    AVG(najemnina_m2) as povprecna_najemnina_m2,
    PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY najemnina_m2) as p10_najemnina_m2,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY najemnina_m2) as p90_najemnina_m2,
    
    AVG(skupna_najemnina) as povprecna_skupna_najemnina,
    PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY skupna_najemnina) as p10_skupna_najemnina,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY skupna_najemnina) as p90_skupna_najemnina,
    
    AVG(povrsina) as povprecna_velikost_m2,
    PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY povrsina) as p10_velikost_m2,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY povrsina) as p90_velikost_m2,
    
    AVG(starost_stavbe) as povprecna_starost_stavbe,
    PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY starost_stavbe) as p10_starost_stavbe,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY starost_stavbe) as p90_starost_stavbe,
    
    AVG(je_opremljena::numeric) * 100 as delez_opremljenih_pct,
    
    COUNT(*) as stevilo_poslov,
    SUM(trenutno_aktivna) as trenutno_v_najemu
    
FROM najemni_podatki
WHERE vrsta_nepremicnine IN (1, 2)
GROUP BY obcina, vrsta_nepremicnine, leto_posla;

-- Indeksi za materialized view
CREATE INDEX idx_mv_najemne_regija_leto ON stats.mv_najemne_statistike(obcina, vrsta_nepremicnine, leto);
CREATE INDEX idx_mv_najemne_ko_leto ON stats.mv_najemne_statistike(ime_ko, vrsta_nepremicnine, leto);
CREATE INDEX idx_mv_najemne_vrsta ON stats.mv_najemne_statistike(vrsta_nepremicnine);