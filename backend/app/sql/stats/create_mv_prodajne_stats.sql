-- =============================================================================
-- MATERIALIZED VIEW ZA PRODAJNE STATISTIKE
-- =============================================================================
-- Namen: Agregira prodajne podatke po katastrskih občinah in občinah
-- Logika: 
-- 1. Pripravi osnovne prodajne podatke z validacijo
-- 2. Izračuna statistike po katastrskih občinah (NIVO 1)
-- 3. Izračuna agregirane statistike po občinah (NIVO 2)
-- =============================================================================

DROP MATERIALIZED VIEW IF EXISTS stats.mv_prodajne_statistike;
CREATE MATERIALIZED VIEW stats.mv_prodajne_statistike AS (

-- KORAK 1: PRIPRAVA OSNOVNIH PRODAJNIH PODATKOV
-- =============================================
WITH prodajni_podatki AS (
    SELECT 
        -- Identifikatorji
        k.obcina,
        k.ime_ko,
        kp.posel_id,
        
        CASE 
            WHEN k.vrsta_nepremicnine = 1 THEN 'hisa'
            WHEN k.vrsta_nepremicnine = 2 THEN 'stanovanje'
            ELSE 'drugo'
        END as vrsta_nepremicnine,

        
        -- CENOVNI PODATKI
        -- ==============
        CASE 
            WHEN k.povrsina_uporabna IS NOT NULL 
            AND k.povrsina_uporabna > 5
            AND kp.cena IS NOT NULL 
            AND kp.cena > 5000
            AND kp.cena < 10000000
            THEN kp.cena / k.povrsina_uporabna
            ELSE NULL 
        END as cena_m2_osnovna,

        CASE 
            WHEN kp.cena IS NOT NULL 
            AND kp.cena > 5000
            AND kp.cena < 10000000
            THEN kp.cena
            ELSE NULL 
        END as cena_osnovna,


        -- VELIKOSTNI PODATKI
        -- ==================
        CASE 
            WHEN k.povrsina_uporabna IS NOT NULL 
            AND k.povrsina_uporabna > 5
            THEN k.povrsina_uporabna
            ELSE NULL 
        END as povrsina_uporabna,
        

        -- STAROST STAVBE
        -- ==============
        CASE 
            WHEN k.leto_izgradnje_stavbe IS NOT NULL 
            THEN date_part('year', kp.datum_sklenitve) - k.leto_izgradnje_stavbe
            ELSE NULL
        END as starost_stavbe,  -- takratna starost stavbe ko se je sklenil posel
        
        CASE 
            WHEN k.leto_izgradnje_stavbe IS NOT NULL 
            THEN k.leto_izgradnje_stavbe
            ELSE NULL
        END as leto_izgradnje_stavbe,

        -- DATUMI
        -- ======
        kp.datum_sklenitve,
        date_part('year', kp.datum_sklenitve) as leto_sklenitve
        
    FROM core.kpp_del_stavbe k
    JOIN core.kpp_posel kp ON k.posel_id = kp.posel_id
    WHERE 
        -- FILTRIRANJE PODATKOV
        -- tukaj so samo splošni filtri, vsak stolpec ima tudi svoje specifične filtre - z namenom da ima aggregacija cim vec podatkov
        -- ===================
        kp.vrsta_posla IN (1,2)
        AND k.ime_ko IS NOT NULL
        AND k.obcina IS NOT NULL
        AND kp.datum_sklenitve IS NOT NULL
        AND date_part('year', kp.datum_sklenitve) BETWEEN 2007 AND EXTRACT(YEAR FROM CURRENT_DATE)
        AND k.vrsta_nepremicnine IN (1, 2)
        and k.tip_rabe = 'bivalno'
        AND k.prodani_delez = '1/1' 
),


-- KORAK 2: IZRAČUN KOLIKO VALIDNIH NEPREMIČNIN JE V POSLU IN DELITEV CENE S TEM ŠTEVILOM (ker je v enem poslu lahko več validnih nepremičnin in to bloata statistike)
-- =============================================
posel_stats AS (
    SELECT 
        posel_id,
        COUNT(*) as stevilo_delov_stavb
    FROM prodajni_podatki
    GROUP BY posel_id
),

vsi_deli_posla AS (
    SELECT 
        posel_id,
        COUNT(*) as skupno_stevilo_delov_stavb
    FROM core.kpp_del_stavbe 
    GROUP BY posel_id
),

prodajni_podatki_z_razdeljeno_ceno AS (
    SELECT 
        pp.*,
        ps.stevilo_delov_stavb,
        
        -- PORAZDELJENA CENA
        -- =================
        CASE 
            WHEN pp.cena_osnovna IS NOT NULL 
            AND ps.stevilo_delov_stavb > 0
            THEN pp.cena_osnovna / ps.stevilo_delov_stavb
            ELSE NULL 
        END as skupna_cena,

        -- PORAZDELJENA CENA NA M2
        -- =======================
        CASE 
            WHEN pp.cena_osnovna IS NOT NULL 
            AND ps.stevilo_delov_stavb > 0
            AND pp.povrsina_uporabna IS NOT NULL 
            AND pp.povrsina_uporabna > 5
            THEN (pp.cena_osnovna / ps.stevilo_delov_stavb) / pp.povrsina_uporabna
            ELSE NULL 
        END as cena_m2
        
    FROM prodajni_podatki pp
    JOIN posel_stats ps ON pp.posel_id = ps.posel_id
    JOIN vsi_deli_posla vdp ON pp.posel_id = vdp.posel_id
    WHERE ps.stevilo_delov_stavb <= 15  -- Izloči posle z več kot 15 deli stavb
    AND vdp.skupno_stevilo_delov_stavb <= 25  -- Izloči posle z več kot 10 skupnimi deli stavb
)


-- NIVO 1: STATISTIKE PO KATASTRSKIH OBČINAH
-- ==========================================
-- Agregirano samo po ime_ko (obcina = NULL)
SELECT 
    NULL as obcina,  -- NULL ker je agregirano čez več občin
    ime_ko,
    vrsta_nepremicnine,
    leto_sklenitve as leto,
    
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
    AVG(povrsina_uporabna) as povprecna_velikost_m2,
    PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY povrsina_uporabna) as p10_velikost_m2,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY povrsina_uporabna) as p90_velikost_m2,
    
    -- STAROST STAVB
    -- =============
    AVG(starost_stavbe) as povprecna_starost_stavbe,
    PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY starost_stavbe) as p10_starost_stavbe,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY starost_stavbe) as p90_starost_stavbe,
    
    -- AKTIVNOST PRODAJNEGA TRGA
    -- =========================
    COUNT(*) as stevilo_poslov
    
FROM prodajni_podatki_z_razdeljeno_ceno
GROUP BY ime_ko, vrsta_nepremicnine, leto_sklenitve

UNION ALL

-- NIVO 2: STATISTIKE PO OBČINAH
-- ==============================
-- Agregirano po občinah (ime_ko = NULL)
SELECT 
    obcina,
    NULL as ime_ko,  -- NULL ker gledamo samo občine
    vrsta_nepremicnine,
    leto_sklenitve as leto,
    
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
    AVG(povrsina_uporabna) as povprecna_velikost_m2,
    PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY povrsina_uporabna) as p10_velikost_m2,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY povrsina_uporabna) as p90_velikost_m2,
    
    -- STAROST STAVB
    -- =============
    AVG(starost_stavbe) as povprecna_starost_stavbe,
    PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY starost_stavbe) as p10_starost_stavbe,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY starost_stavbe) as p90_starost_stavbe,
    
    -- AKTIVNOST PRODAJNEGA TRGA
    -- =========================
    COUNT(*) as stevilo_poslov
    
FROM prodajni_podatki_z_razdeljeno_ceno
GROUP BY obcina, vrsta_nepremicnine, leto_sklenitve);

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