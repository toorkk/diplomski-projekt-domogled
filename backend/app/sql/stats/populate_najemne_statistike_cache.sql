-- INSERT za KATASTRSKE OBČINE
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
    'letno' as tip_obdobja,
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
FROM stats.mv_najemne_statistike
WHERE obcina IS NULL AND ime_ko IS NOT NULL  -- KO statistike (kjer je obcina NULL)
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

-- INSERT za OBČINE
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
    'letno' as tip_obdobja,
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
FROM stats.mv_najemne_statistike
WHERE ime_ko IS NULL  -- Občinske statistike (kjer je ime_ko NULL)
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