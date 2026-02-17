DROP MATERIALIZED VIEW IF EXISTS stats.mv_najemne_statistike;
CREATE MATERIALIZED VIEW stats.mv_najemne_statistike AS 

WITH konstante AS (
    SELECT DATE '2008-01-01' as MIN_DATUM
), 
najemni_podatki AS (
    SELECT 
        n.obcina,
        n.sifra_ko,
        np.posel_id,
        CASE 
            WHEN n.vrsta_nepremicnine = 1 THEN 'hisa'
            WHEN n.vrsta_nepremicnine = 2 THEN 'stanovanje'
            ELSE 'drugo'
        END as vrsta_nepremicnine,
        
        -- Osnovni izračuni (brez deljenja s številom delov stavb še tukaj)
        CASE 
            WHEN np.najemnina > 0 AND np.najemnina < 2000 THEN np.najemnina
            ELSE NULL 
        END as najemnina_osnovna,

        CASE 
            WHEN n.povrsina_uporabna > 5 THEN n.povrsina_uporabna
            ELSE NULL 
        END as povrsina_uporabna,
        
        CASE 
            WHEN n.leto_izgradnje_stavbe IS NOT NULL 
            THEN EXTRACT(YEAR FROM np.datum_uveljavitve) - n.leto_izgradnje_stavbe
            ELSE NULL
        END as starost_stavbe,
        
        np.datum_uveljavitve,
        np.datum_zacetka_najemanja,
        np.datum_zakljucka_najema,
        np.datum_sklenitve,
        
        EXTRACT(YEAR FROM np.datum_zacetka_najemanja) as leto_zacetka,
        CASE 
            WHEN np.datum_zakljucka_najema IS NOT NULL 
            THEN EXTRACT(YEAR FROM np.datum_zakljucka_najema)
            ELSE EXTRACT(YEAR FROM CURRENT_DATE)
        END as leto_konca
    FROM core.np_del_stavbe n
    JOIN core.np_posel np ON n.posel_id = np.posel_id
    CROSS JOIN konstante k -- POPRAVEK: Tukaj vključimo konstante
    WHERE 
        np.vrsta_posla IN (1,2) 
        AND n.sifra_ko IS NOT NULL
        AND n.obcina IS NOT NULL
        AND n.vrsta_nepremicnine IN (1, 2)
        AND np.datum_zacetka_najemanja > k.MIN_DATUM
        AND np.datum_uveljavitve > k.MIN_DATUM
),

najemni_podatki_po_letih AS (
    SELECT 
        np.*,
        gs.year_num as leto_najema
    FROM najemni_podatki np
    CROSS JOIN LATERAL generate_series(
        CAST(np.leto_zacetka AS INTEGER), 
        CAST(np.leto_konca AS INTEGER)
    ) as gs(year_num)
    WHERE gs.year_num BETWEEN 2008 AND EXTRACT(YEAR FROM CURRENT_DATE)
),

filtered_posli AS (
    SELECT 
        posel_id,
        COUNT(DISTINCT (obcina, sifra_ko, vrsta_nepremicnine)) as stevilo_delov_stavb
    FROM najemni_podatki_po_letih
    GROUP BY posel_id
),

vsi_posli AS (
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
        -- Razdeljena najemnina (skupni znesek / število enot v poslu)
        (np.najemnina_osnovna / NULLIF(ps.stevilo_delov_stavb, 0)) as skupna_najemnina,
        -- Cena na m2
        (np.najemnina_osnovna / NULLIF(ps.stevilo_delov_stavb, 0)) / NULLIF(np.povrsina_uporabna, 0) as najemnina_m2
    FROM najemni_podatki_po_letih np
    JOIN filtered_posli ps ON np.posel_id = ps.posel_id
    JOIN vsi_posli vsip ON np.posel_id = vsip.posel_id
    WHERE ps.stevilo_delov_stavb <= 15
    AND vsip.skupno_stevilo_delov_stavb <= 25
)

SELECT 
    CASE 
        WHEN GROUPING(obcina) = 1 AND GROUPING(sifra_ko) = 1 THEN 'slovenija'
        WHEN GROUPING(obcina) = 1 THEN 'katastrska_obcina'
        ELSE 'obcina'
    END as tip_regije,
    
    CASE 
        WHEN GROUPING(obcina) = 1 AND GROUPING(sifra_ko) = 1 THEN 'SLOVENIJA'
        WHEN GROUPING(obcina) = 1 THEN sifra_ko::TEXT
        ELSE obcina
    END as ime_regije,
    
    vrsta_nepremicnine,
    'najem' as tip_posla,
    leto_najema as leto,

    ROUND(AVG(najemnina_m2)::numeric, 2) as povprecna_cena_m2,
    ROUND(AVG(skupna_najemnina)::numeric, 2) as povprecna_skupna_cena,
    ROUND(AVG(povrsina_uporabna)::numeric) as povprecna_velikost_m2,
    ROUND(AVG(starost_stavbe)::numeric) as povprecna_starost_stavbe,
    
    SUM(CASE WHEN EXTRACT(YEAR FROM datum_sklenitve) = leto_najema THEN 1 ELSE 0 END) as stevilo_poslov,
    COUNT(*) as aktivna_v_letu, -- Ker vsaka vrstica predstavlja eno leto aktivnosti
    
    COUNT(najemnina_m2) as cena_m2_count,
    COUNT(skupna_najemnina) as skupna_cena_count,
    COUNT(povrsina_uporabna) as velikost_m2_count,
    COUNT(starost_stavbe) as starost_stavbe_count
    
FROM najemni_podatki_z_razdeljeno_najemnino
GROUP BY GROUPING SETS (
    (sifra_ko, vrsta_nepremicnine, leto_najema),
    (obcina, vrsta_nepremicnine, leto_najema),
    (vrsta_nepremicnine, leto_najema)
);

-- Indeksi ostanejo isti
CREATE INDEX idx_mv_najemne_universal ON stats.mv_najemne_statistike(tip_regije, ime_regije, vrsta_nepremicnine, leto);