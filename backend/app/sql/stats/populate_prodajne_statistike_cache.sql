-- =============================================================================
-- UNIFIED CACHE POPULATION - VSE STATISTIKE V ENEM SKRIPTU
-- =============================================================================
-- Uporablja GROUPING SETS materialized view-je za poenostavljeno polnjenje cache-a

-- LETNE STATISTIKE - VSE HKRATI (prodaja + najem)
-- ===============================================
INSERT INTO stats.statistike_cache (
    tip_regije, ime_regije, vrsta_nepremicnine, tip_posla, tip_obdobja, leto,
    povprecna_cena_m2, povprecna_skupna_cena, stevilo_poslov, trenutno_v_najemu, povprecna_velikost_m2, 
    povprecna_starost_stavbe, cena_m2_count, skupna_cena_count, velikost_m2_count, starost_stavbe_count
)
-- PRODAJA (brez najemnih podatkov)
SELECT 
    tip_regije, ime_regije, vrsta_nepremicnine, tip_posla, 'letno' as tip_obdobja, leto,
    povprecna_cena_m2, povprecna_skupna_cena, stevilo_poslov, 
    NULL::INTEGER as trenutno_v_najemu, -- eksplicitno NULL
    povprecna_velikost_m2, 
    ROUND(povprecna_starost_stavbe)::INTEGER as povprecna_starost_stavbe, -- celo število
    cena_m2_count, skupna_cena_count, velikost_m2_count, starost_stavbe_count
FROM stats.mv_prodajne_statistike

UNION ALL

-- NAJEM (z najemnimi podatki)
SELECT 
    tip_regije, ime_regije, vrsta_nepremicnine, tip_posla, 'letno' as tip_obdobja, leto,
    povprecna_cena_m2, povprecna_skupna_cena, stevilo_poslov, 
    trenutno_v_najemu,
    povprecna_velikost_m2, 
    ROUND(povprecna_starost_stavbe)::INTEGER as povprecna_starost_stavbe, -- celo število
    cena_m2_count, skupna_cena_count, velikost_m2_count, starost_stavbe_count
FROM stats.mv_najemne_statistike;

-- ZADNJIH 12 MESECEV - VSE HKRATI (prodaja + najem)
-- ================================================
INSERT INTO stats.statistike_cache (
    tip_regije, ime_regije, vrsta_nepremicnine, tip_posla, tip_obdobja, leto,
    povprecna_cena_m2, povprecna_skupna_cena, stevilo_poslov, trenutno_v_najemu, povprecna_velikost_m2,
    povprecna_starost_stavbe, cena_m2_count, skupna_cena_count, velikost_m2_count, starost_stavbe_count
)
SELECT 
    tip_regije, ime_regije, vrsta_nepremicnine, tip_posla, 'zadnjih12m' as tip_obdobja, NULL as leto,
    AVG(povprecna_cena_m2) as povprecna_cena_m2,
    AVG(povprecna_skupna_cena) as povprecna_skupna_cena,
    SUM(stevilo_poslov) as stevilo_poslov,
    SUM(trenutno_v_najemu) as trenutno_v_najemu, -- NULL za prodajo, seštevek za najem
    AVG(povprecna_velikost_m2) as povprecna_velikost_m2,
    ROUND(AVG(povprecna_starost_stavbe))::INTEGER as povprecna_starost_stavbe, -- celo število
    SUM(cena_m2_count) as cena_m2_count,
    SUM(skupna_cena_count) as skupna_cena_count,
    SUM(velikost_m2_count) as velikost_m2_count,
    SUM(starost_stavbe_count) as starost_stavbe_count
FROM (
    -- PRODAJA (brez najemnih podatkov)
    SELECT 
        tip_regije, ime_regije, vrsta_nepremicnine, tip_posla, leto,
        povprecna_cena_m2, povprecna_skupna_cena, stevilo_poslov, povprecna_velikost_m2, povprecna_starost_stavbe,
        cena_m2_count, skupna_cena_count, velikost_m2_count, starost_stavbe_count,
        NULL::INTEGER as trenutno_v_najemu
    FROM stats.mv_prodajne_statistike 
    WHERE leto >= EXTRACT(YEAR FROM CURRENT_DATE) - 1
    
    UNION ALL
    
    -- NAJEM (z najemnimi podatki)
    SELECT 
        tip_regije, ime_regije, vrsta_nepremicnine, tip_posla, leto,
        povprecna_cena_m2, povprecna_skupna_cena, stevilo_poslov, povprecna_velikost_m2, povprecna_starost_stavbe,
        cena_m2_count, skupna_cena_count, velikost_m2_count, starost_stavbe_count,
        trenutno_v_najemu
    FROM stats.mv_najemne_statistike 
    WHERE leto >= EXTRACT(YEAR FROM CURRENT_DATE) - 1
) kombiniran
GROUP BY tip_regije, ime_regije, vrsta_nepremicnine, tip_posla;