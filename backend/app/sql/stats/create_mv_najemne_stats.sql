-- =============================================================================
-- MATERIALIZED VIEW ZA NAJEMNE STATISTIKE
-- =============================================================================
-- Namen: Agregira najemne podatke po katastrskih občinah, občinah in za celo Slovenijo
-- Logika: 
-- 1. Pripravi osnovne najemne podatke z validacijo
-- 2. Izračuna statistike z GROUPING SETS na vseh nivojih hkrati
-- =============================================================================

DROP MATERIALIZED VIEW IF EXISTS stats.mv_najemne_statistike;
CREATE MATERIALIZED VIEW stats.mv_najemne_statistike AS (

-- KORAK 1: PRIPRAVA OSNOVNIH NAJEMNIH PODATKOV
-- ============================================
WITH najemni_podatki AS (
    SELECT 
        -- Identifikatorji regij
        n.obcina,
        n.ime_ko,
        np.posel_id,
        
        -- Vrsta nepremičnine
        CASE 
            WHEN n.vrsta_nepremicnine = 1 THEN 'hisa'
            WHEN n.vrsta_nepremicnine = 2 THEN 'stanovanje'
            ELSE 'drugo'
        END as vrsta_nepremicnine,
        
        -- CENOVNI PODATKI
        -- ==============
        CASE 
            WHEN n.povrsina_uporabna IS NOT NULL 
            AND n.povrsina_uporabna > 5
            AND np.najemnina IS NOT NULL 
            AND np.najemnina > 0
            AND np.najemnina < 2000
            THEN np.najemnina / n.povrsina_uporabna
            ELSE NULL 
        END as najemnina_m2_osnovna,

        CASE 
            WHEN np.najemnina IS NOT NULL 
            AND np.najemnina > 0
            AND np.najemnina < 2000
            THEN np.najemnina
            ELSE NULL 
        END as najemnina_osnovna,

        -- VELIKOSTNI PODATKI
        -- ==================
        CASE 
            WHEN n.povrsina_uporabna IS NOT NULL 
            AND n.povrsina_uporabna > 5
            THEN n.povrsina_uporabna
            ELSE NULL 
        END as povrsina_uporabna,
        
        -- STAROST STAVBE
        -- ==============
        CASE 
            WHEN n.leto_izgradnje_stavbe IS NOT NULL 
            THEN date_part('year', np.datum_uveljavitve) - n.leto_izgradnje_stavbe
            ELSE NULL
        END as starost_stavbe,
        
        -- DATUMI
        -- ======
        np.datum_uveljavitve,
        date_part('year', np.datum_uveljavitve) as leto_uveljavitve,
        
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
        np.vrsta_posla IN (1,2)  -- Samo najemni posli
        AND n.ime_ko IS NOT NULL
        AND n.obcina IS NOT NULL
        AND np.datum_uveljavitve IS NOT NULL
        AND date_part('year', np.datum_uveljavitve) BETWEEN 2007 AND EXTRACT(YEAR FROM CURRENT_DATE)
        AND n.vrsta_nepremicnine IN (1, 2)
        AND np.datum_zacetka_najemanja > DATE '2008-01-01'
        AND np.datum_zakljucka_najema > DATE '2008-01-01'  
        AND np.datum_uveljavitve > DATE '2008-01-01'
        AND np.datum_sklenitve > DATE '2008-01-01'
),

-- KORAK 2: IZRAČUN KOLIKO VALIDNIH NEPREMIČNIN JE V POSLU IN DELITEV NAJEMNINE S TEM ŠTEVILOM
-- =============================================

posel_stats AS (
    SELECT 
        posel_id,
        COUNT(*) as stevilo_delov_stavb
    FROM najemni_podatki
    GROUP BY posel_id
),

vsi_deli_posla AS (
    SELECT 
        posel_id,
        COUNT(*) as skupno_stevilo_delov_stavb
    FROM core.np_del_stavbe 
    GROUP BY posel_id
),

najemni_podatki_z_razdeljeno_najemnino AS (
    SELECT 
        np.*,
        ps.stevilo_delov_stavb,
        
        -- PORAZDELJENA NAJEMNINA
        -- ======================
        CASE 
            WHEN np.najemnina_osnovna IS NOT NULL 
            AND ps.stevilo_delov_stavb > 0
            THEN np.najemnina_osnovna / ps.stevilo_delov_stavb
            ELSE NULL 
        END as skupna_najemnina,

        -- PORAZDELJENA NAJEMNINA NA M2
        -- ============================
        CASE 
            WHEN np.najemnina_osnovna IS NOT NULL 
            AND ps.stevilo_delov_stavb > 0
            AND np.povrsina_uporabna IS NOT NULL 
            AND np.povrsina_uporabna > 5
            THEN (np.najemnina_osnovna / ps.stevilo_delov_stavb) / np.povrsina_uporabna
            ELSE NULL 
        END as najemnina_m2
        
    FROM najemni_podatki np
    JOIN posel_stats ps ON np.posel_id = ps.posel_id
    JOIN vsi_deli_posla vdp ON np.posel_id = vdp.posel_id
    WHERE ps.stevilo_delov_stavb <= 15
    AND vdp.skupno_stevilo_delov_stavb <= 25
)

-- ZDRUŽENE STATISTIKE Z GROUPING SETS
-- ===================================
SELECT 
    -- DIMENZIJE REGIJE
    -- ================
    CASE 
        WHEN GROUPING(obcina, ime_ko) = 3 THEN 'slovenija'  -- Oba NULL
        WHEN GROUPING(obcina) = 1 THEN 'katastrska_obcina'  -- obcina=NULL, ime_ko!=NULL  
        ELSE 'obcina'  -- obcina!=NULL, ime_ko=NULL
    END as tip_regije,
    
    CASE 
        WHEN GROUPING(obcina, ime_ko) = 3 THEN 'Slovenija'
        WHEN GROUPING(obcina) = 1 THEN ime_ko
        ELSE obcina
    END as ime_regije,
    
    -- OSTALE DIMENZIJE
    -- ================
    vrsta_nepremicnine,
    'najem' as tip_posla,
    leto_uveljavitve as leto,

    -- AGREGIRANE MERIKE (poenotena imena s prodajo)
    -- ===========================================
    AVG(najemnina_m2) as povprecna_cena_m2,
    AVG(skupna_najemnina) as povprecna_skupna_cena,
    AVG(povrsina_uporabna) as povprecna_velikost_m2,
    AVG(starost_stavbe) as povprecna_starost_stavbe,
    COUNT(*) as stevilo_poslov,
    
    -- NAJEMNI SPECIFIČNI PODATKI
    -- ==========================
    SUM(trenutno_aktivna) as trenutno_v_najemu,
    
    -- COUNT STATISTIKE
    -- ================
    COUNT(CASE WHEN najemnina_m2 IS NOT NULL THEN 1 END) as cena_m2_count,
    COUNT(CASE WHEN skupna_najemnina IS NOT NULL THEN 1 END) as skupna_cena_count,
    COUNT(CASE WHEN povrsina_uporabna IS NOT NULL THEN 1 END) as velikost_m2_count,
    COUNT(CASE WHEN starost_stavbe IS NOT NULL THEN 1 END) as starost_stavbe_count
    
FROM najemni_podatki_z_razdeljeno_najemnino
GROUP BY GROUPING SETS (
    (ime_ko, vrsta_nepremicnine, leto_uveljavitve),     -- Katastrske občine
    (obcina, vrsta_nepremicnine, leto_uveljavitve),     -- Občine  
    (vrsta_nepremicnine, leto_uveljavitve)              -- Slovenija
));

-- =============================================================================
-- KREIRANJE INDEKSOV ZA OPTIMALNO PERFORMANCO
-- =============================================================================

-- Univerzalni indeks za vse tipe regij
CREATE INDEX idx_mv_najemne_universal 
ON stats.mv_najemne_statistike(tip_regije, ime_regije, vrsta_nepremicnine, leto);

-- Indeks za poizvedbe po vrsti nepremičnine
CREATE INDEX idx_mv_najemne_vrsta 
ON stats.mv_najemne_statistike(vrsta_nepremicnine);