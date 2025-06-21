-- PRODAJA - KATASTRSKE OBČINE (zadnjih 12 mesecev)
INSERT INTO stats.statistike_cache (
    tip_regije, ime_regije, vrsta_nepremicnine, tip_posla, 
    tip_obdobja, leto, povprecna_cena_m2, povprecna_skupna_cena,
    stevilo_poslov, povprecna_velikost_m2, povprecna_starost_stavbe,
    cena_m2_count, skupna_cena_count, velikost_m2_count, starost_stavbe_count
)
SELECT 
    'katastrska_obcina' as tip_regije,
    ime_ko as ime_regije,
    vrsta_nepremicnine,
    'prodaja' as tip_posla,
    'zadnjih12m' as tip_obdobja,
    NULL as leto,
    AVG(povprecna_cena_m2) as povprecna_cena_m2,
    AVG(povprecna_skupna_cena) as povprecna_skupna_cena,
    SUM(stevilo_poslov) as stevilo_poslov,
    AVG(povprecna_velikost_m2) as povprecna_velikost_m2,
    AVG(povprecna_starost_stavbe) as povprecna_starost_stavbe,
    SUM(cena_m2_count) as cena_m2_count,
    SUM(skupna_cena_count) as skupna_cena_count,
    SUM(velikost_m2_count) as velikost_m2_count,
    SUM(starost_stavbe_count) as starost_stavbe_count
FROM stats.mv_prodajne_statistike
WHERE leto >= EXTRACT(YEAR FROM CURRENT_DATE) - 1
  AND obcina IS NULL  -- KO statistike
GROUP BY ime_ko, vrsta_nepremicnine
ON CONFLICT (tip_regije, ime_regije, vrsta_nepremicnine, tip_posla, tip_obdobja, leto) 
DO UPDATE SET
    povprecna_cena_m2 = EXCLUDED.povprecna_cena_m2,
    povprecna_skupna_cena = EXCLUDED.povprecna_skupna_cena,
    stevilo_poslov = EXCLUDED.stevilo_poslov,
    povprecna_velikost_m2 = EXCLUDED.povprecna_velikost_m2,
    povprecna_starost_stavbe = EXCLUDED.povprecna_starost_stavbe,
    cena_m2_count = EXCLUDED.cena_m2_count,
    skupna_cena_count = EXCLUDED.skupna_cena_count,
    velikost_m2_count = EXCLUDED.velikost_m2_count,
    starost_stavbe_count = EXCLUDED.starost_stavbe_count;

-- PRODAJA - OBČINE (zadnjih 12 mesecev)
INSERT INTO stats.statistike_cache (
    tip_regije,
    ime_regije,
    vrsta_nepremicnine,
    tip_posla,
    tip_obdobja,
    leto,
    povprecna_cena_m2,
    povprecna_skupna_cena,
    stevilo_poslov,
    povprecna_velikost_m2,
    povprecna_starost_stavbe,
    cena_m2_count,
    skupna_cena_count,
    velikost_m2_count,
    starost_stavbe_count
)
SELECT 
    'obcina' as tip_regije,
    obcina as ime_regije,
    vrsta_nepremicnine,
    'prodaja' as tip_posla,
    'zadnjih12m' as tip_obdobja,
    NULL as leto,
    AVG(povprecna_cena_m2) as povprecna_cena_m2,
    AVG(povprecna_skupna_cena) as povprecna_skupna_cena,
    SUM(stevilo_poslov) as stevilo_poslov,
    AVG(povprecna_velikost_m2) as povprecna_velikost_m2,
    AVG(povprecna_starost_stavbe) as povprecna_starost_stavbe,
    SUM(cena_m2_count) as cena_m2_count,
    SUM(skupna_cena_count) as skupna_cena_count,
    SUM(velikost_m2_count) as velikost_m2_count,
    SUM(starost_stavbe_count) as starost_stavbe_count
FROM stats.mv_prodajne_statistike
WHERE leto >= EXTRACT(YEAR FROM CURRENT_DATE) - 1
  AND ime_ko IS NULL  -- Občinske statistike
GROUP BY obcina, vrsta_nepremicnine
ON CONFLICT (tip_regije, ime_regije, vrsta_nepremicnine, tip_posla, tip_obdobja, leto) 
DO UPDATE SET
    povprecna_cena_m2 = EXCLUDED.povprecna_cena_m2,
    povprecna_skupna_cena = EXCLUDED.povprecna_skupna_cena,
    stevilo_poslov = EXCLUDED.stevilo_poslov,
    povprecna_velikost_m2 = EXCLUDED.povprecna_velikost_m2,
    povprecna_starost_stavbe = EXCLUDED.povprecna_starost_stavbe,
    cena_m2_count = EXCLUDED.cena_m2_count,
    skupna_cena_count = EXCLUDED.skupna_cena_count,
    velikost_m2_count = EXCLUDED.velikost_m2_count,
    starost_stavbe_count = EXCLUDED.starost_stavbe_count;

-- NAJEM - KATASTRSKE OBČINE (zadnjih 12 mesecev)
INSERT INTO stats.statistike_cache (
    tip_regije,
    ime_regije,
    vrsta_nepremicnine,
    tip_posla,
    tip_obdobja,
    leto,
    povprecna_cena_m2,
    povprecna_skupna_cena,
    stevilo_poslov,
    povprecna_velikost_m2,
    povprecna_starost_stavbe,
    cena_m2_count,
    skupna_cena_count,
    velikost_m2_count,
    starost_stavbe_count
)
SELECT 
    'katastrska_obcina' as tip_regije,
    ime_ko as ime_regije,
    vrsta_nepremicnine,
    'najem' as tip_posla,
    'zadnjih12m' as tip_obdobja,
    NULL as leto,
    AVG(povprecna_cena_m2) as povprecna_cena_m2,
    AVG(povprecna_skupna_cena) as povprecna_skupna_cena,
    SUM(stevilo_poslov) as stevilo_poslov,
    AVG(povprecna_velikost_m2) as povprecna_velikost_m2,
    AVG(povprecna_starost_stavbe) as povprecna_starost_stavbe,
    SUM(cena_m2_count) as cena_m2_count,
    SUM(skupna_cena_count) as skupna_cena_count,
    SUM(velikost_m2_count) as velikost_m2_count,
    SUM(starost_stavbe_count) as starost_stavbe_count
FROM stats.mv_najemne_statistike
WHERE leto >= EXTRACT(YEAR FROM CURRENT_DATE) - 1
  AND obcina IS NULL  -- KO statistike
GROUP BY ime_ko, vrsta_nepremicnine
ON CONFLICT (tip_regije, ime_regije, vrsta_nepremicnine, tip_posla, tip_obdobja, leto) 
DO UPDATE SET
    povprecna_cena_m2 = EXCLUDED.povprecna_cena_m2,
    povprecna_skupna_cena = EXCLUDED.povprecna_skupna_cena,
    stevilo_poslov = EXCLUDED.stevilo_poslov,
    povprecna_velikost_m2 = EXCLUDED.povprecna_velikost_m2,
    povprecna_starost_stavbe = EXCLUDED.povprecna_starost_stavbe,
    cena_m2_count = EXCLUDED.cena_m2_count,
    skupna_cena_count = EXCLUDED.skupna_cena_count,
    velikost_m2_count = EXCLUDED.velikost_m2_count,
    starost_stavbe_count = EXCLUDED.starost_stavbe_count;

-- NAJEM - OBČINE (zadnjih 12 mesecev)
INSERT INTO stats.statistike_cache (
    tip_regije,
    ime_regije,
    vrsta_nepremicnine,
    tip_posla,
    tip_obdobja,
    leto,
    povprecna_cena_m2,
    povprecna_skupna_cena,
    stevilo_poslov,
    povprecna_velikost_m2,
    povprecna_starost_stavbe,
    cena_m2_count,
    skupna_cena_count,
    velikost_m2_count,
    starost_stavbe_count
)
SELECT 
    'obcina' as tip_regije,
    obcina as ime_regije,
    vrsta_nepremicnine,
    'najem' as tip_posla,
    'zadnjih12m' as tip_obdobja,
    NULL as leto,
    AVG(povprecna_cena_m2) as povprecna_cena_m2,
    AVG(povprecna_skupna_cena) as povprecna_skupna_cena,
    SUM(stevilo_poslov) as stevilo_poslov,
    AVG(povprecna_velikost_m2) as povprecna_velikost_m2,
    AVG(povprecna_starost_stavbe) as povprecna_starost_stavbe,
    SUM(cena_m2_count) as cena_m2_count,
    SUM(skupna_cena_count) as skupna_cena_count,
    SUM(velikost_m2_count) as velikost_m2_count,
    SUM(starost_stavbe_count) as starost_stavbe_count
FROM stats.mv_najemne_statistike
WHERE leto >= EXTRACT(YEAR FROM CURRENT_DATE) - 1
  AND ime_ko IS NULL  -- Občinske statistike
GROUP BY obcina, vrsta_nepremicnine
ON CONFLICT (tip_regije, ime_regije, vrsta_nepremicnine, tip_posla, tip_obdobja, leto) 
DO UPDATE SET
    povprecna_cena_m2 = EXCLUDED.povprecna_cena_m2,
    povprecna_skupna_cena = EXCLUDED.povprecna_skupna_cena,
    stevilo_poslov = EXCLUDED.stevilo_poslov,
    povprecna_velikost_m2 = EXCLUDED.povprecna_velikost_m2,
    povprecna_starost_stavbe = EXCLUDED.povprecna_starost_stavbe,
    cena_m2_count = EXCLUDED.cena_m2_count,
    skupna_cena_count = EXCLUDED.skupna_cena_count,
    velikost_m2_count = EXCLUDED.velikost_m2_count,
    starost_stavbe_count = EXCLUDED.starost_stavbe_count;