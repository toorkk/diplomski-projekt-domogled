-- =============================================================================
-- UNIFIED CACHE POPULATION - VSE STATISTIKE V ENEM SKRIPTU
-- =============================================================================
-- Uporablja GROUPING SETS materialized view-je za poenostavljeno polnjenje cache-a

-- LETNE STATISTIKE - VSE HKRATI (prodaja + najem)
-- ===============================================
INSERT INTO stats.statistike_cache (
    tip_regije, ime_regije, vrsta_nepremicnine, tip_posla, tip_obdobja, leto,
    povprecna_cena_m2, povprecna_skupna_cena, stevilo_poslov, aktivna_v_letu, povprecna_velikost_m2, 
    povprecna_starost_stavbe, cena_m2_count, skupna_cena_count, velikost_m2_count, starost_stavbe_count
)
-- PRODAJA
SELECT 
    tip_regije, ime_regije, vrsta_nepremicnine, tip_posla, 'letno' as tip_obdobja, leto,
    povprecna_cena_m2, povprecna_skupna_cena, stevilo_poslov, 
    NULL::INTEGER as aktivna_v_letu, -- eksplicitno NULL
    povprecna_velikost_m2, 
    ROUND(povprecna_starost_stavbe)::INTEGER as povprecna_starost_stavbe, -- celo število
    cena_m2_count, skupna_cena_count, velikost_m2_count, starost_stavbe_count
FROM stats.mv_prodajne_statistike

UNION ALL

-- NAJEM
SELECT 
    tip_regije, ime_regije, vrsta_nepremicnine, tip_posla, 'letno' as tip_obdobja, leto,
    povprecna_cena_m2, povprecna_skupna_cena, stevilo_poslov, 
    aktivna_v_letu,
    povprecna_velikost_m2, 
    ROUND(povprecna_starost_stavbe)::INTEGER as povprecna_starost_stavbe, -- celo število
    cena_m2_count, skupna_cena_count, velikost_m2_count, starost_stavbe_count
FROM stats.mv_najemne_statistike;

-- ZADNJIH 12 MESECEV - VSE HKRATI (prodaja + najem) 
-- TO JE TO DO KER MI ŽE GREJO TI PODATKI NA ŽIVCE
-- ================================================
