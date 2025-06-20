-- =============================================================================
-- KREIRANJE MATERIALIZED VIEW ZA PRODAJNE STATISTIKE
-- =============================================================================
-- Namen: Agregira prodajne podatke po katastrskih občinah in občinah
-- Logika: 
-- 1. Pripravi osnovne prodajne podatke z validacijo
-- 2. Izračuna statistike po katastrskih občinah (NIVO 1)
-- 3. Izračuna agregirane statistike po občinah (NIVO 2)
-- =============================================================================

DROP MATERIALIZED VIEW IF EXISTS stats.mv_prodajne_statistike;
CREATE MATERIALIZED VIEW stats.mv_prodajne_statistike AS

-- KORAK 1: PRIPRAVA OSNOVNIH PRODAJNIH PODATKOV
-- =============================================
WITH prodajni_podatki AS (
    SELECT 
        -- Identifikatorji regij
        k.obcina,
        k.ime_ko,
        
        -- Vrsta nepremičnine
        CASE 
            WHEN k.vrsta_nepremicnine = 1 THEN 'hisa'
            WHEN k.vrsta_nepremicnine = 2 THEN 'stanovanje'
            ELSE 'drugo'
        END as vrsta_nepremicnine,

        
        -- CENOVNI PODATKI
        -- ==============
        CASE 
            WHEN COALESCE(k.povrsina_uradna, k.povrsina_pogodba) > 0 
            THEN kp.cena / COALESCE(k.povrsina_uradna, k.povrsina_pogodba)
            ELSE NULL 
        END as cena_m2,
        kp.cena as skupna_cena,
        
        -- VELIKOSTNI PODATKI
        -- ==================
        COALESCE(k.povrsina_uradna, k.povrsina_pogodba) as povrsina,
        
        -- STAROST STAVBE
        -- ==============
        CASE 
            WHEN k.leto_izgradnje_stavbe IS NOT NULL 
            THEN k.leto - k.leto_izgradnje_stavbe
            ELSE NULL
        END as starost_stavbe,
        
        -- DATUMI
        -- ======
        kp.datum_uveljavitve,
        date_part('year', kp.datum_uveljavitve) as leto_uveljavitve
        
    FROM core.kpp_del_stavbe k
    JOIN core.kpp_posel kp ON k.posel_id = kp.posel_id
    WHERE 
        -- FILTRIRANJE PODATKOV
        -- ===================
        kp.cena IS NOT NULL 
        AND kp.cena > 0
        AND prodani_delez = '1/1'
        AND kp.vrsta_posla IN (1,2)  -- Samo prodajni posli
        AND COALESCE(k.povrsina_uradna, k.povrsina_pogodba) IS NOT NULL 
        AND COALESCE(k.povrsina_uradna, k.povrsina_pogodba) > 0
        AND k.ime_ko IS NOT NULL
        AND k.obcina IS NOT NULL
        AND k.leto IS NOT NULL
        AND k.leto BETWEEN 2000 AND EXTRACT(YEAR FROM CURRENT_DATE)  -- Razumno časovno okno
)

-- NIVO 1: STATISTIKE PO KATASTRSKIH OBČINAH
-- ==========================================
-- Agregirano samo po ime_ko (obcina = NULL)
SELECT 
    NULL as obcina,  -- NULL ker je agregirano čez več občin
    ime_ko,
    vrsta_nepremicnine,
    leto_uveljavitve as leto,
    
    -- CENOVNI PODATKI NA M²
    -- ====================
    AVG(cena_m2) as povprecna_cena_m2,
    PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY cena_m2) as p10_cena_m2,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY cena_m2) as p90_cena_m2,
    
    -- SKUPNE PRODAJNE CENE
    -- ====================
    AVG(skupna_cena) as povprecna_skupna_cena,
    PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY skupna_cena) as p10_skupna_cena,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY skupna_cena) as p90_skupna_cena,
    
    -- VELIKOSTI NEPREMIČNIN
    -- =====================
    AVG(povrsina) as povprecna_velikost_m2,
    PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY povrsina) as p10_velikost_m2,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY povrsina) as p90_velikost_m2,
    
    -- STAROST STAVB
    -- =============
    AVG(starost_stavbe) as povprecna_starost_stavbe,
    PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY starost_stavbe) as p10_starost_stavbe,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY starost_stavbe) as p90_starost_stavbe,
    
    -- AKTIVNOST PRODAJNEGA TRGA
    -- =========================
    COUNT(*) as stevilo_poslov
    
FROM prodajni_podatki
WHERE vrsta_nepremicnine IN ('hisa', 'stanovanje')
GROUP BY ime_ko, vrsta_nepremicnine, leto_uveljavitve

UNION ALL

-- NIVO 2: STATISTIKE PO OBČINAH
-- ==============================
-- Agregirano po občinah (ime_ko = NULL)
SELECT 
    obcina,
    NULL as ime_ko,  -- NULL ker gledamo samo občine
    vrsta_nepremicnine,
    leto_uveljavitve as leto,
    
    -- CENOVNI PODATKI NA M²
    -- ====================
    AVG(cena_m2) as povprecna_cena_m2,
    PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY cena_m2) as p10_cena_m2,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY cena_m2) as p90_cena_m2,
    
    -- SKUPNE PRODAJNE CENE
    -- ====================
    AVG(skupna_cena) as povprecna_skupna_cena,
    PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY skupna_cena) as p10_skupna_cena,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY skupna_cena) as p90_skupna_cena,
    
    -- VELIKOSTI NEPREMIČNIN
    -- =====================
    AVG(povrsina) as povprecna_velikost_m2,
    PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY povrsina) as p10_velikost_m2,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY povrsina) as p90_velikost_m2,
    
    -- STAROST STAVB
    -- =============
    AVG(starost_stavbe) as povprecna_starost_stavbe,
    PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY starost_stavbe) as p10_starost_stavbe,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY starost_stavbe) as p90_starost_stavbe,
    
    -- AKTIVNOST PRODAJNEGA TRGA
    -- =========================
    COUNT(*) as stevilo_poslov
    
FROM prodajni_podatki
WHERE vrsta_nepremicnine IN ('hisa', 'stanovanje')
GROUP BY obcina, vrsta_nepremicnine, leto_uveljavitve;

-- =============================================================================
-- KREIRANJE INDEKSOV ZA OPTIMALNO PERFORMANCO
-- =============================================================================

-- Indeks za poizvedbe po občinah in letih
CREATE INDEX idx_mv_prodajne_regija_leto 
ON stats.mv_prodajne_statistike(obcina, vrsta_nepremicnine, leto);

-- Indeks za poizvedbe po katastrskih občinah in letih
CREATE INDEX idx_mv_prodajne_ko_leto 
ON stats.mv_prodajne_statistike(ime_ko, vrsta_nepremicnine, leto);

-- Indeks za poizvedbe po vrsti nepremičnine
CREATE INDEX idx_mv_prodajne_vrsta 
ON stats.mv_prodajne_statistike(vrsta_nepremicnine);