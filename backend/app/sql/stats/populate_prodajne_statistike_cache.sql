-- INSERT za KATASTRSKE OBČINE
INSERT INTO stats.statistike_cache (
    tip_regije,
    ime_regije,
    tip_nepremicnine,
    tip_posla,
    tip_obdobja,
    leto,
    povprecna_cena_m2, percentil_10_cena_m2, percentil_90_cena_m2,
    povprecna_skupna_cena, percentil_10_skupna_cena, percentil_90_skupna_cena,
    stevilo_poslov,
    povprecna_velikost_m2, percentil_10_velikost_m2, percentil_90_velikost_m2,
    povprecna_starost_stavbe, percentil_10_starost_stavbe, percentil_90_starost_stavbe
)
SELECT 
    'katastrska_obcina' as tip_regije,
    ime_ko as ime_regije,
    tip_nepremicnine,
    'prodaja' as tip_posla,
    'letno' as tip_obdobja,
    leto,
    povprecna_cena_m2, p10_cena_m2, p90_cena_m2,
    povprecna_skupna_cena, p10_skupna_cena, p90_skupna_cena,
    stevilo_poslov,
    povprecna_velikost_m2, p10_velikost_m2, p90_velikost_m2,
    povprecna_starost_stavbe, p10_starost_stavbe, p90_starost_stavbe
FROM stats.mv_prodajne_statistike
WHERE obcina IS NULL AND ime_ko IS NOT NULL  -- KO statistike (kjer je obcina NULL)
ON CONFLICT (tip_regije, ime_regije, tip_nepremicnine, tip_posla, tip_obdobja, leto) 
DO UPDATE SET
    povprecna_cena_m2 = EXCLUDED.povprecna_cena_m2,
    percentil_10_cena_m2 = EXCLUDED.percentil_10_cena_m2,
    percentil_90_cena_m2 = EXCLUDED.percentil_90_cena_m2,
    povprecna_skupna_cena = EXCLUDED.povprecna_skupna_cena,
    percentil_10_skupna_cena = EXCLUDED.percentil_10_skupna_cena,
    percentil_90_skupna_cena = EXCLUDED.percentil_90_skupna_cena,
    stevilo_poslov = EXCLUDED.stevilo_poslov,
    povprecna_velikost_m2 = EXCLUDED.povprecna_velikost_m2,
    percentil_10_velikost_m2 = EXCLUDED.percentil_10_velikost_m2,
    percentil_90_velikost_m2 = EXCLUDED.percentil_90_velikost_m2,
    povprecna_starost_stavbe = EXCLUDED.povprecna_starost_stavbe,
    percentil_10_starost_stavbe = EXCLUDED.percentil_10_starost_stavbe,
    percentil_90_starost_stavbe = EXCLUDED.percentil_90_starost_stavbe;

-- INSERT za OBČINE
INSERT INTO stats.statistike_cache (
    tip_regije,
    ime_regije,
    tip_nepremicnine,
    tip_posla,
    tip_obdobja,
    leto,
    povprecna_cena_m2, percentil_10_cena_m2, percentil_90_cena_m2,
    povprecna_skupna_cena, percentil_10_skupna_cena, percentil_90_skupna_cena,
    stevilo_poslov,
    povprecna_velikost_m2, percentil_10_velikost_m2, percentil_90_velikost_m2,
    povprecna_starost_stavbe, percentil_10_starost_stavbe, percentil_90_starost_stavbe
)
SELECT 
    'obcina' as tip_regije,
    obcina as ime_regije,
    tip_nepremicnine,
    'prodaja' as tip_posla,
    'letno' as tip_obdobja,
    leto,
    povprecna_cena_m2, p10_cena_m2, p90_cena_m2,
    povprecna_skupna_cena, p10_skupna_cena, p90_skupna_cena,
    stevilo_poslov,
    povprecna_velikost_m2, p10_velikost_m2, p90_velikost_m2,
    povprecna_starost_stavbe, p10_starost_stavbe, p90_starost_stavbe
FROM stats.mv_prodajne_statistike
WHERE ime_ko IS NULL  -- Občinske statistike (kjer je ime_ko NULL)
ON CONFLICT (tip_regije, ime_regije, tip_nepremicnine, tip_posla, tip_obdobja, leto) 
DO UPDATE SET
    povprecna_cena_m2 = EXCLUDED.povprecna_cena_m2,
    percentil_10_cena_m2 = EXCLUDED.percentil_10_cena_m2,
    percentil_90_cena_m2 = EXCLUDED.percentil_90_cena_m2,
    povprecna_skupna_cena = EXCLUDED.povprecna_skupna_cena,
    percentil_10_skupna_cena = EXCLUDED.percentil_10_skupna_cena,
    percentil_90_skupna_cena = EXCLUDED.percentil_90_skupna_cena,
    stevilo_poslov = EXCLUDED.stevilo_poslov,
    povprecna_velikost_m2 = EXCLUDED.povprecna_velikost_m2,
    percentil_10_velikost_m2 = EXCLUDED.percentil_10_velikost_m2,
    percentil_90_velikost_m2 = EXCLUDED.percentil_90_velikost_m2,
    povprecna_starost_stavbe = EXCLUDED.povprecna_starost_stavbe,
    percentil_10_starost_stavbe = EXCLUDED.percentil_10_starost_stavbe,
    percentil_90_starost_stavbe = EXCLUDED.percentil_90_starost_stavbe;