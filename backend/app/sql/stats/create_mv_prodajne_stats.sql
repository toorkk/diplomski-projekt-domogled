-- =============================================================================
-- MATERIALIZED VIEW ZA PRODAJNE STATISTIKE
-- =============================================================================
-- Namen: Agregira prodajne podatke po katastrskih občinah, občinah in za celo Slovenijo
-- Logika: 
-- 1. Pripravi osnovne prodajne podatke z validacijo
-- 2. Izračuna statistike z GROUPING SETS na vseh nivojih hkrati
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
            AND kp.cena < 5400000
            THEN kp.cena / k.povrsina_uporabna
            ELSE NULL 
        END as cena_m2_osnovna,

        CASE 
            WHEN kp.cena IS NOT NULL 
            AND kp.cena > 5000
            AND kp.cena < 5400000
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
        END as starost_stavbe,

        -- DATUMI
        -- ======
        date_part('year', kp.datum_sklenitve) as leto_sklenitve
        
    FROM core.kpp_del_stavbe k
    JOIN core.kpp_posel kp ON k.posel_id = kp.posel_id
    WHERE 
        -- FILTRIRANJE PODATKOV
        -- ===================
        kp.vrsta_posla IN (1,2)
        AND k.ime_ko IS NOT NULL
        AND k.obcina IS NOT NULL
        AND kp.datum_sklenitve IS NOT NULL
        AND date_part('year', kp.datum_sklenitve) BETWEEN 2007 AND EXTRACT(YEAR FROM CURRENT_DATE)
        AND k.vrsta_nepremicnine IN (1, 2)
        AND k.tip_rabe = 'bivalno'
        AND k.prodani_delez = '1/1'
),

-- KORAK 2: IZRAČUN KOLIKO VALIDNIH NEPREMIČNIN JE V POSLU IN DELITEV CENE S TEM ŠTEVILOM
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
    'prodaja' as tip_posla,
    leto_sklenitve as leto,

    -- AGREGIRANE MERIKE (poenotena imena z najemom)
    -- ============================================
    AVG(cena_m2) as povprecna_cena_m2,
    AVG(skupna_cena) as povprecna_skupna_cena,
    AVG(povrsina_uporabna) as povprecna_velikost_m2,
    AVG(starost_stavbe) as povprecna_starost_stavbe,
    COUNT(*) as stevilo_poslov,
    
    -- COUNT STATISTIKE
    -- ================
    COUNT(CASE WHEN cena_m2 IS NOT NULL THEN 1 END) as cena_m2_count,
    COUNT(CASE WHEN skupna_cena IS NOT NULL THEN 1 END) as skupna_cena_count,
    COUNT(CASE WHEN povrsina_uporabna IS NOT NULL THEN 1 END) as velikost_m2_count,
    COUNT(CASE WHEN starost_stavbe IS NOT NULL THEN 1 END) as starost_stavbe_count
    
FROM prodajni_podatki_z_razdeljeno_ceno
GROUP BY GROUPING SETS (
    (ime_ko, vrsta_nepremicnine, leto_sklenitve),     -- Katastrske občine
    (obcina, vrsta_nepremicnine, leto_sklenitve),     -- Občine  
    (vrsta_nepremicnine, leto_sklenitve)              -- Slovenija
));

-- =============================================================================
-- KREIRANJE INDEKSOV
-- =============================================================================

CREATE INDEX idx_mv_prodajne_universal 
ON stats.mv_prodajne_statistike(tip_regije, ime_regije, vrsta_nepremicnine, leto);

CREATE INDEX idx_mv_prodajne_vrsta 
ON stats.mv_prodajne_statistike(vrsta_nepremicnine);