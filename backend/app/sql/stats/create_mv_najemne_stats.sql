-- =============================================================================
-- MATERIALIZED VIEW ZA NAJEMNE STATISTIKE
-- =============================================================================
-- Namen: Agregira najemne podatke po katastrskih občinah in občinah
-- Logika: 
-- 1. Pripravi osnovne najemne podatke z validacijo
-- 2. Izračuna statistike po katastrskih občinah (NIVO 1)
-- 3. Izračuna agregirane statistike po občinah (NIVO 2)
-- =============================================================================

DROP MATERIALIZED VIEW IF EXISTS stats.mv_najemne_statistike;
CREATE MATERIALIZED VIEW stats.mv_najemne_statistike AS

-- KORAK 1: PRIPRAVA OSNOVNIH NAJEMNIH PODATKOV
-- ============================================
WITH najemni_podatki AS (
    SELECT 
        -- Identifikatorji regij
        n.obcina,
        n.ime_ko,
        
        -- Vrsta nepremičnine
        CASE 
            WHEN n.vrsta_nepremicnine = 1 THEN 'hisa'
            WHEN n.vrsta_nepremicnine = 2 THEN 'stanovanje'
            ELSE 'drugo'
        END as vrsta_nepremicnine,
        
        
        -- CENOVNI PODATKI
        -- ==============
        CASE 
            WHEN COALESCE(n.povrsina_uradna, n.povrsina_pogodba) > 0 
            THEN np.najemnina / COALESCE(n.povrsina_uradna, n.povrsina_pogodba)
            ELSE NULL 
        END as najemnina_m2,
        np.najemnina as skupna_najemnina,
        
        -- VELIKOSTNI PODATKI
        -- ==================
        COALESCE(n.povrsina_pogodba, n.povrsina_uradna) as povrsina,
        COALESCE(n.povrsina_uporabna_pogodba, n.povrsina_uporabna_uradna) as povrsina_uporabna,
        
        -- STAROST STAVBE
        -- ==============
        CASE 
            WHEN n.leto_izgradnje_stavbe IS NOT NULL 
            THEN n.leto - n.leto_izgradnje_stavbe
            ELSE NULL
        END as starost_stavbe,
        
        -- OPREMLJENOST
        -- ============
        CASE 
            WHEN n.opremljenost = 1 THEN 1 
            ELSE 0 
        END as je_opremljena,
        
        -- DATUMI
        -- ======
        np.datum_uveljavitve,
        date_part('year', np.datum_uveljavitve) as leto_uveljavitve,
        np.datum_prenehanja_najemanja,
        
        -- STATUS AKTIVNOSTI
        -- =================
        CASE 
            WHEN (np.datum_prenehanja_najemanja IS NULL OR np.datum_prenehanja_najemanja > CURRENT_DATE)
                AND (np.datum_zakljucka_najema IS NULL OR np.datum_zakljucka_najema > CURRENT_DATE)
            THEN 1 ELSE 0 
        END as trenutno_aktivna
        
    FROM core.np_del_stavbe n
    JOIN core.np_posel np ON n.posel_id = np.posel_id
    WHERE 
        -- FILTRIRANJE PODATKOV
        -- ===================
        np.najemnina IS NOT NULL 
        AND np.najemnina > 0
        AND np.vrsta_posla IN (1,2)  -- Samo najemni posli
        AND COALESCE(n.povrsina_uradna, n.povrsina_pogodba) IS NOT NULL 
        AND COALESCE(n.povrsina_uradna, n.povrsina_pogodba) > 0
        AND n.ime_ko IS NOT NULL
        AND n.obcina IS NOT NULL
        AND datum_zacetka_najemanja > DATE '2008-01-01'
        AND datum_zakljucka_najema > DATE '2008-01-01'  
        AND datum_uveljavitve > DATE '2008-01-01'
        AND datum_sklenitve > DATE '2008-01-01'
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
    AVG(najemnina_m2) as povprecna_najemnina_m2,
    PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY najemnina_m2) as p10_najemnina_m2,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY najemnina_m2) as p90_najemnina_m2,
    
    -- SKUPNE NAJEMNINE
    -- ================
    AVG(skupna_najemnina) as povprecna_skupna_najemnina,
    PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY skupna_najemnina) as p10_skupna_najemnina,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY skupna_najemnina) as p90_skupna_najemnina,
    
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
    
    -- OPREMLJENOST
    -- ============
    AVG(je_opremljena::numeric) * 100 as delez_opremljenih_pct,
    
    -- AKTIVNOST NAJEMNEGA TRGA
    -- ========================
    COUNT(*) as stevilo_poslov,
    SUM(trenutno_aktivna) as trenutno_v_najemu
    
FROM najemni_podatki
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
    AVG(najemnina_m2) as povprecna_najemnina_m2,
    PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY najemnina_m2) as p10_najemnina_m2,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY najemnina_m2) as p90_najemnina_m2,
    
    -- SKUPNE NAJEMNINE
    -- ================
    AVG(skupna_najemnina) as povprecna_skupna_najemnina,
    PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY skupna_najemnina) as p10_skupna_najemnina,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY skupna_najemnina) as p90_skupna_najemnina,
    
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
    
    -- OPREMLJENOST
    -- ============
    AVG(je_opremljena::numeric) * 100 as delez_opremljenih_pct,
    
    -- AKTIVNOST NAJEMNEGA TRGA
    -- ========================
    COUNT(*) as stevilo_poslov,
    SUM(trenutno_aktivna) as trenutno_v_najemu
    
FROM najemni_podatki
WHERE vrsta_nepremicnine IN ('hisa', 'stanovanje')
GROUP BY obcina, vrsta_nepremicnine, leto_uveljavitve;

-- =============================================================================
-- INDEKSI
-- =============================================================================

-- Indeks za poizvedbe po občinah in letih
CREATE INDEX idx_mv_najemne_regija_leto 
ON stats.mv_najemne_statistike(obcina, vrsta_nepremicnine, leto);

-- Indeks za poizvedbe po katastrskih občinah in letih
CREATE INDEX idx_mv_najemne_ko_leto 
ON stats.mv_najemne_statistike(ime_ko, vrsta_nepremicnine, leto);

-- Indeks za poizvedbe po vrsti nepremičnine
CREATE INDEX idx_mv_najemne_vrsta 
ON stats.mv_najemne_statistike(vrsta_nepremicnine);