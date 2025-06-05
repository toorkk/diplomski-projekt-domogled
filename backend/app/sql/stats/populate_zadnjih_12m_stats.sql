-- PRODAJA - KATASTRSKE OBČINE (zadnjih 12 mesecev)
INSERT INTO stats.statistike_cache (
    tip_regije, ime_regije, tip_nepremicnine, tip_posla, 
    tip_obdobja, leto, povprecna_cena_m2, percentil_10_cena_m2, 
    percentil_90_cena_m2, povprecna_skupna_cena, percentil_10_skupna_cena,
    percentil_90_skupna_cena, stevilo_poslov, povprecna_velikost_m2,
    percentil_10_velikost_m2, percentil_90_velikost_m2, povprecna_starost_stavbe,
    percentil_10_starost_stavbe, percentil_90_starost_stavbe, delez_agencijskih_pct
)
SELECT 
    'katastrska_obcina' as tip_regije,
    ime_ko as ime_regije,
    tip_nepremicnine,
    'prodaja' as tip_posla,
    'zadnjih12m' as tip_obdobja,
    NULL as leto,
    AVG(povprecna_cena_m2) as povprecna_cena_m2,
    AVG(p10_cena_m2) as percentil_10_cena_m2,
    AVG(p90_cena_m2) as percentil_90_cena_m2,
    AVG(povprecna_skupna_cena) as povprecna_skupna_cena,
    AVG(p10_skupna_cena) as percentil_10_skupna_cena,
    AVG(p90_skupna_cena) as percentil_90_skupna_cena,
    SUM(stevilo_poslov) as stevilo_poslov,
    AVG(povprecna_velikost_m2) as povprecna_velikost_m2,
    AVG(p10_velikost_m2) as percentil_10_velikost_m2,
    AVG(p90_velikost_m2) as percentil_90_velikost_m2,
    AVG(povprecna_starost_stavbe) as povprecna_starost_stavbe,
    AVG(p10_starost_stavbe) as percentil_10_starost_stavbe,
    AVG(p90_starost_stavbe) as percentil_90_starost_stavbe,
    AVG(delez_agencijskih_pct) as delez_agencijskih_pct
FROM stats.mv_prodajne_statistike
WHERE leto >= EXTRACT(YEAR FROM CURRENT_DATE) - 1
  AND obcina IS NULL  -- KO statistike
GROUP BY ime_ko, tip_nepremicnine
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
    percentil_90_starost_stavbe = EXCLUDED.percentil_90_starost_stavbe,
    delez_agencijskih_pct = EXCLUDED.delez_agencijskih_pct;

-- PRODAJA - OBČINE (zadnjih 12 mesecev)
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
    povprecna_starost_stavbe, percentil_10_starost_stavbe, percentil_90_starost_stavbe,
    delez_agencijskih_pct
)
SELECT 
    'obcina' as tip_regije,
    obcina as ime_regije,
    tip_nepremicnine,
    'prodaja' as tip_posla,
    'zadnjih12m' as tip_obdobja,
    NULL as leto,
    AVG(povprecna_cena_m2) as povprecna_cena_m2,
    AVG(p10_cena_m2) as percentil_10_cena_m2,
    AVG(p90_cena_m2) as percentil_90_cena_m2,
    AVG(povprecna_skupna_cena) as povprecna_skupna_cena,
    AVG(p10_skupna_cena) as percentil_10_skupna_cena,
    AVG(p90_skupna_cena) as percentil_90_skupna_cena,
    SUM(stevilo_poslov) as stevilo_poslov,
    AVG(povprecna_velikost_m2) as povprecna_velikost_m2,
    AVG(p10_velikost_m2) as percentil_10_velikost_m2,
    AVG(p90_velikost_m2) as percentil_90_velikost_m2,
    AVG(povprecna_starost_stavbe) as povprecna_starost_stavbe,
    AVG(p10_starost_stavbe) as percentil_10_starost_stavbe,
    AVG(p90_starost_stavbe) as percentil_90_starost_stavbe,
    AVG(delez_agencijskih_pct) as delez_agencijskih_pct
FROM stats.mv_prodajne_statistike
WHERE leto >= EXTRACT(YEAR FROM CURRENT_DATE) - 1
  AND ime_ko IS NULL  -- Občinske statistike
GROUP BY obcina, tip_nepremicnine
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
    percentil_90_starost_stavbe = EXCLUDED.percentil_90_starost_stavbe,
    delez_agencijskih_pct = EXCLUDED.delez_agencijskih_pct;

-- NAJEM - KATASTRSKE OBČINE (zadnjih 12 mesecev)
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
    trenutno_v_najemu,
    povprecna_velikost_m2, percentil_10_velikost_m2, percentil_90_velikost_m2,
    povprecna_starost_stavbe, percentil_10_starost_stavbe, percentil_90_starost_stavbe,
    delez_opremljenih_pct,
    delez_agencijskih_pct
)
SELECT 
    'katastrska_obcina' as tip_regije,
    ime_ko as ime_regije,
    tip_nepremicnine,
    'najem' as tip_posla,
    'zadnjih12m' as tip_obdobja,
    NULL as leto,
    AVG(povprecna_najemnina_m2) as povprecna_cena_m2,
    AVG(p10_najemnina_m2) as percentil_10_cena_m2,
    AVG(p90_najemnina_m2) as percentil_90_cena_m2,
    AVG(povprecna_skupna_najemnina) as povprecna_skupna_cena,
    AVG(p10_skupna_najemnina) as percentil_10_skupna_cena,
    AVG(p90_skupna_najemnina) as percentil_90_skupna_cena,
    SUM(stevilo_poslov) as stevilo_poslov,
    SUM(trenutno_v_najemu) as trenutno_v_najemu,
    AVG(povprecna_velikost_m2) as povprecna_velikost_m2,
    AVG(p10_velikost_m2) as percentil_10_velikost_m2,
    AVG(p90_velikost_m2) as percentil_90_velikost_m2,
    AVG(povprecna_starost_stavbe) as povprecna_starost_stavbe,
    AVG(p10_starost_stavbe) as percentil_10_starost_stavbe,
    AVG(p90_starost_stavbe) as percentil_90_starost_stavbe,
    AVG(delez_opremljenih_pct) as delez_opremljenih_pct,
    AVG(delez_agencijskih_pct) as delez_agencijskih_pct
FROM stats.mv_najemne_statistike
WHERE leto >= EXTRACT(YEAR FROM CURRENT_DATE) - 1
  AND obcina IS NULL  -- KO statistike
GROUP BY ime_ko, tip_nepremicnine
ON CONFLICT (tip_regije, ime_regije, tip_nepremicnine, tip_posla, tip_obdobja, leto) 
DO UPDATE SET
    povprecna_cena_m2 = EXCLUDED.povprecna_cena_m2,
    percentil_10_cena_m2 = EXCLUDED.percentil_10_cena_m2,
    percentil_90_cena_m2 = EXCLUDED.percentil_90_cena_m2,
    povprecna_skupna_cena = EXCLUDED.povprecna_skupna_cena,
    percentil_10_skupna_cena = EXCLUDED.percentil_10_skupna_cena,
    percentil_90_skupna_cena = EXCLUDED.percentil_90_skupna_cena,
    stevilo_poslov = EXCLUDED.stevilo_poslov,
    trenutno_v_najemu = EXCLUDED.trenutno_v_najemu,
    povprecna_velikost_m2 = EXCLUDED.povprecna_velikost_m2,
    percentil_10_velikost_m2 = EXCLUDED.percentil_10_velikost_m2,
    percentil_90_velikost_m2 = EXCLUDED.percentil_90_velikost_m2,
    povprecna_starost_stavbe = EXCLUDED.povprecna_starost_stavbe,
    percentil_10_starost_stavbe = EXCLUDED.percentil_10_starost_stavbe,
    percentil_90_starost_stavbe = EXCLUDED.percentil_90_starost_stavbe,
    delez_opremljenih_pct = EXCLUDED.delez_opremljenih_pct,
    delez_agencijskih_pct = EXCLUDED.delez_agencijskih_pct;

-- NAJEM - OBČINE (zadnjih 12 mesecev)
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
    trenutno_v_najemu,
    povprecna_velikost_m2, percentil_10_velikost_m2, percentil_90_velikost_m2,
    povprecna_starost_stavbe, percentil_10_starost_stavbe, percentil_90_starost_stavbe,
    delez_opremljenih_pct,
    delez_agencijskih_pct
)
SELECT 
    'obcina' as tip_regije,
    obcina as ime_regije,
    tip_nepremicnine,
    'najem' as tip_posla,
    'zadnjih12m' as tip_obdobja,
    NULL as leto,
    AVG(povprecna_najemnina_m2) as povprecna_cena_m2,
    AVG(p10_najemnina_m2) as percentil_10_cena_m2,
    AVG(p90_najemnina_m2) as percentil_90_cena_m2,
    AVG(povprecna_skupna_najemnina) as povprecna_skupna_cena,
    AVG(p10_skupna_najemnina) as percentil_10_skupna_cena,
    AVG(p90_skupna_najemnina) as percentil_90_skupna_cena,
    SUM(stevilo_poslov) as stevilo_poslov,
    SUM(trenutno_v_najemu) as trenutno_v_najemu,
    AVG(povprecna_velikost_m2) as povprecna_velikost_m2,
    AVG(p10_velikost_m2) as percentil_10_velikost_m2,
    AVG(p90_velikost_m2) as percentil_90_velikost_m2,
    AVG(povprecna_starost_stavbe) as povprecna_starost_stavbe,
    AVG(p10_starost_stavbe) as percentil_10_starost_stavbe,
    AVG(p90_starost_stavbe) as percentil_90_starost_stavbe,
    AVG(delez_opremljenih_pct) as delez_opremljenih_pct,
    AVG(delez_agencijskih_pct) as delez_agencijskih_pct
FROM stats.mv_najemne_statistike
WHERE leto >= EXTRACT(YEAR FROM CURRENT_DATE) - 1
  AND ime_ko IS NULL  -- Občinske statistike
GROUP BY obcina, tip_nepremicnine
ON CONFLICT (tip_regije, ime_regije, tip_nepremicnine, tip_posla, tip_obdobja, leto) 
DO UPDATE SET
    povprecna_cena_m2 = EXCLUDED.povprecna_cena_m2,
    percentil_10_cena_m2 = EXCLUDED.percentil_10_cena_m2,
    percentil_90_cena_m2 = EXCLUDED.percentil_90_cena_m2,
    povprecna_skupna_cena = EXCLUDED.povprecna_skupna_cena,
    percentil_10_skupna_cena = EXCLUDED.percentil_10_skupna_cena,
    percentil_90_skupna_cena = EXCLUDED.percentil_90_skupna_cena,
    stevilo_poslov = EXCLUDED.stevilo_poslov,
    trenutno_v_najemu = EXCLUDED.trenutno_v_najemu,
    povprecna_velikost_m2 = EXCLUDED.povprecna_velikost_m2,
    percentil_10_velikost_m2 = EXCLUDED.percentil_10_velikost_m2,
    percentil_90_velikost_m2 = EXCLUDED.percentil_90_velikost_m2,
    povprecna_starost_stavbe = EXCLUDED.povprecna_starost_stavbe,
    percentil_10_starost_stavbe = EXCLUDED.percentil_10_starost_stavbe,
    percentil_90_starost_stavbe = EXCLUDED.percentil_90_starost_stavbe,
    delez_opremljenih_pct = EXCLUDED.delez_opremljenih_pct,
    delez_agencijskih_pct = EXCLUDED.delez_agencijskih_pct;