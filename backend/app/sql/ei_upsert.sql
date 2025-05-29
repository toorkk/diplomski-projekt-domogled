INSERT INTO core.energetska_izkaznica (
    ei_id, 
    datum_izdelave, 
    velja_do, 
    sifra_ko, 
    stevilka_stavbe, 
    stevilka_dela_stavbe, 
    tip_izkaznice, 
    potrebna_toplota_ogrevanje,
    dovedena_energija_delovanje, 
    celotna_energija, 
    dovedena_elektricna_energija,
    primarna_energija, 
    emisije_co2, 
    kondicionirana_povrsina,
    energijski_razred, 
    epbd_tip
)
SELECT 
    ei_id, 
    datum_izdelave, 
    velja_do, 
    sifra_ko, 
    stevilka_stavbe, 
    stevilka_dela_stavbe, 
    tip_izkaznice, 
    potrebna_toplota_ogrevanje,
    dovedena_energija_delovanje, 
    celotna_energija, 
    dovedena_elektricna_energija,
    primarna_energija, 
    emisije_co2, 
    kondicionirana_povrsina,
    energijski_razred, 
    epbd_tip
FROM staging.energetska_izkaznica
WHERE sifra_ko IS NOT NULL AND stevilka_stavbe IS NOT NULL AND stevilka_dela_stavbe IS NOT NULL
ON CONFLICT (ei_id) 
DO UPDATE SET
    datum_izdelave = EXCLUDED.datum_izdelave,
    velja_do = EXCLUDED.velja_do,
    sifra_ko = EXCLUDED.sifra_ko,
    stevilka_stavbe = EXCLUDED.stevilka_stavbe,
    stevilka_dela_stavbe = EXCLUDED.stevilka_dela_stavbe,
    tip_izkaznice = EXCLUDED.tip_izkaznice,
    potrebna_toplota_ogrevanje = EXCLUDED.potrebna_toplota_ogrevanje,
    dovedena_energija_delovanje = EXCLUDED.dovedena_energija_delovanje,
    celotna_energija = EXCLUDED.celotna_energija,
    dovedena_elektricna_energija = EXCLUDED.dovedena_elektricna_energija,
    primarna_energija = EXCLUDED.primarna_energija,
    emisije_co2 = EXCLUDED.emisije_co2,
    kondicionirana_povrsina = EXCLUDED.kondicionirana_povrsina,
    energijski_razred = EXCLUDED.energijski_razred,
    epbd_tip = EXCLUDED.epbd_tip
WHERE 
    -- Posodobi samo če je novi datum_izdelave kasnejši
    EXCLUDED.datum_izdelave > core.energetska_izkaznica.datum_izdelave
    OR core.energetska_izkaznica.datum_izdelave IS NULL;