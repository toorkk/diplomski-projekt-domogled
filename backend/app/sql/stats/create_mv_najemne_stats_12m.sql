-- =============================================================================
-- MATERIALIZED VIEW ZA NAJEMNE STATISTIKE - ZADNJIH 12 MESECEV
-- =============================================================================
-- Namen: Agregira najemne podatke za zadnjih 12 mesecev po katastrskih občinah, občinah in za celo Slovenijo
-- Logika: 
-- 1. Pripravi osnovne najemne podatke z validacijo
-- 2. Izračuna statistike z GROUPING SETS na vseh nivojih hkrati
-- =============================================================================

DROP MATERIALIZED VIEW IF EXISTS stats.mv_najemne_statistike_12m;
CREATE MATERIALIZED VIEW stats.mv_najemne_statistike_12m AS (

-- KORAK 1: PRIPRAVA OSNOVNIH NAJEMNIH PODATKOV - ZADNJIH 12 MESECEV
-- ================================================================
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
        
        -- DATUMI NAJEMA
        -- =============
        np.datum_uveljavitve,
        np.datum_zacetka_najemanja,
        np.datum_zakljucka_najema,
        np.datum_sklenitve,
        
        -- PREVERJANJE ALI JE NAJEM AKTIVEN V ZADNJIH 12 MESECIH
        -- ====================================================
        CASE 
            WHEN np.datum_zacetka_najemanja <= CURRENT_DATE
                AND (np.datum_zakljucka_najema IS NULL 
                     OR np.datum_zakljucka_najema >= CURRENT_DATE - INTERVAL '12 months')
            THEN 1 
            ELSE 0 
        END as aktivna_v_12m

    FROM core.np_del_stavbe n
    JOIN core.np_posel np ON n.posel_id = np.posel_id
    WHERE 
        -- FILTRIRANJE PODATKOV - ZADNJIH 12 MESECEV
        -- ==========================================
        np.vrsta_posla IN (1,2)  -- Samo najemni posli
        AND n.ime_ko IS NOT NULL
        AND n.obcina IS NOT NULL
        AND np.datum_uveljavitve IS NOT NULL
        AND n.vrsta_nepremicnine IN (1, 2)
        AND np.datum_zacetka_najemanja IS NOT NULL
        AND np.datum_uveljavitve IS NOT NULL
        AND np.datum_sklenitve IS NOT NULL
        -- Vključimo najeme, ki so bili aktivni v zadnjih 12 mesecih
        AND (
            -- Novi najemi sklenjeni v zadnjih 12 mesecih
            np.datum_sklenitve >= CURRENT_DATE - INTERVAL '12 months'
            OR
            -- Ali najemi, ki so se začeli v zadnjih 12 mesecih
            np.datum_zacetka_najemanja >= CURRENT_DATE - INTERVAL '12 months'
            OR
            -- Ali najemi, ki so bili aktivni v zadnjih 12 mesecih (se niso končali ali so se končali v zadnjih 12 mesecih)
            (np.datum_zacetka_najemanja < CURRENT_DATE 
             AND (np.datum_zakljucka_najema IS NULL 
                  OR np.datum_zakljucka_najema >= CURRENT_DATE - INTERVAL '12 months'))
        )
),

-- KORAK 2: IZRAČUN KOLIKO VALIDNIH NEPREMIČNIN JE V POSLU IN DELITEV NAJEMNINE S TEM ŠTEVILOM
-- =========================================================================================
filtered_posli AS (
    SELECT 
        posel_id,
        COUNT(DISTINCT (obcina, ime_ko, vrsta_nepremicnine)) as stevilo_delov_stavb
    FROM najemni_podatki
    GROUP BY posel_id
),

vsi_posli AS (
    SELECT 
        posel_id,
        COUNT(*) as skupno_stevilo_delov_stavb
    FROM core.np_del_stavbe 
    WHERE posel_id IN (SELECT DISTINCT posel_id FROM najemni_podatki)
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
    JOIN filtered_posli ps ON np.posel_id = ps.posel_id
    JOIN vsi_posli vsip ON np.posel_id = vsip.posel_id
    WHERE ps.stevilo_delov_stavb <= 15
    AND vsip.skupno_stevilo_delov_stavb <= 25
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
        WHEN GROUPING(obcina, ime_ko) = 3 THEN 'SLOVENIJA'
        WHEN GROUPING(obcina) = 1 THEN ime_ko
        ELSE obcina
    END as ime_regije,
    
    -- OSTALE DIMENZIJE
    -- ================
    vrsta_nepremicnine,
    'najem' as tip_posla,

    -- AGREGIRANE MERIKE (poenotena imena s prodajo)
    -- ===========================================
    ROUND(AVG(najemnina_m2), 2) as povprecna_cena_m2,
    ROUND(AVG(skupna_najemnina), 2) as povprecna_skupna_cena,
    ROUND(AVG(povrsina_uporabna)) as povprecna_velikost_m2,
    ROUND(AVG(starost_stavbe)) as povprecna_starost_stavbe,
    
    -- ŠTEVILO POSLOV SKLENJENIH V ZADNJIH 12 MESECIH
    -- =============================================
    COUNT(*) as stevilo_poslov,
    
    -- NAJEMNI SPECIFIČNI PODATKI
    -- ==========================
    SUM(aktivna_v_12m) as aktivna_v_letu, -- Aktivni najemi v zadnjih 12 mesecih
    
    -- COUNT STATISTIKE
    -- ================
    COUNT(CASE WHEN najemnina_m2 IS NOT NULL THEN 1 END) as cena_m2_count,
    COUNT(CASE WHEN skupna_najemnina IS NOT NULL THEN 1 END) as skupna_cena_count,
    COUNT(CASE WHEN povrsina_uporabna IS NOT NULL THEN 1 END) as velikost_m2_count,
    COUNT(CASE WHEN starost_stavbe IS NOT NULL THEN 1 END) as starost_stavbe_count
    
FROM najemni_podatki_z_razdeljeno_najemnino
GROUP BY GROUPING SETS (
    (ime_ko, vrsta_nepremicnine),     -- Katastrske občine
    (obcina, vrsta_nepremicnine),     -- Občine  
    (vrsta_nepremicnine)              -- Slovenija
));

-- =============================================================================
-- KREIRANJE INDEKSOV
-- =============================================================================

CREATE INDEX idx_mv_najemne_12m_universal 
ON stats.mv_najemne_statistike_12m(tip_regije, ime_regije, vrsta_nepremicnine);

CREATE INDEX idx_mv_najemne_12m_vrsta 
ON stats.mv_najemne_statistike_12m(vrsta_nepremicnine);