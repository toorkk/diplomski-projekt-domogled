TRUNCATE TABLE core.energetska_izkaznica CASCADE;

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
WHERE sifra_ko IS NOT NULL 
    AND stevilka_stavbe IS NOT NULL 
    AND stevilka_dela_stavbe IS NOT NULL;