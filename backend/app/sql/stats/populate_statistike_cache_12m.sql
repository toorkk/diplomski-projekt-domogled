-- =============================================================================
-- -- POLNJENJE CACHE-A - STATISTIKE ZA ZADNJIH 12 MESECEV
-- =============================================================================

INSERT INTO stats.statistike_cache (
    tip_regije, ime_regije, vrsta_nepremicnine, tip_posla, tip_obdobja, leto,
    povprecna_cena_m2, povprecna_skupna_cena, stevilo_poslov, aktivna_v_letu, povprecna_velikost_m2, 
    povprecna_starost_stavbe, cena_m2_count, skupna_cena_count, velikost_m2_count, starost_stavbe_count
)
-- PRODAJA - ZADNJIH 12 MESECEV
SELECT 
    tip_regije, ime_regije, vrsta_nepremicnine, tip_posla, 'zadnjih12m' as tip_obdobja, 
    NULL::INTEGER as leto, -- NULL za zadnjih12m
    povprecna_cena_m2, povprecna_skupna_cena, stevilo_poslov, 
    NULL::INTEGER as aktivna_v_letu, -- vedno NULL ker je podatek za najemne
    povprecna_velikost_m2, 
    povprecna_starost_stavbe,
    cena_m2_count, skupna_cena_count, velikost_m2_count, starost_stavbe_count
FROM stats.mv_prodajne_statistike_12m

UNION ALL

-- NAJEM - ZADNJIH 12 MESECEV
SELECT 
    tip_regije, ime_regije, vrsta_nepremicnine, tip_posla, 'zadnjih12m' as tip_obdobja, 
    NULL::INTEGER as leto, -- NULL za zadnjih12m
    povprecna_cena_m2, povprecna_skupna_cena, stevilo_poslov, 
    aktivna_v_letu,
    povprecna_velikost_m2, 
    povprecna_starost_stavbe,
    cena_m2_count, skupna_cena_count, velikost_m2_count, starost_stavbe_count
FROM stats.mv_najemne_statistike_12m