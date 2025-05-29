-- Posodobi NP deduplicirane ei
UPDATE core.np_del_stavbe_deduplicated 
SET energetske_izkaznice = ei_grouped.energetske_izkaznice
FROM (
    SELECT 
        ei.sifra_ko,
        ei.stevilka_stavbe,
        ei.stevilka_dela_stavbe,
        ARRAY_AGG(ei.id ORDER BY ei.datum_izdelave DESC) as energetske_izkaznice
    FROM core.energetska_izkaznica ei
    GROUP BY ei.sifra_ko, ei.stevilka_stavbe, ei.stevilka_dela_stavbe
) ei_grouped
WHERE np_del_stavbe_deduplicated.sifra_ko = ei_grouped.sifra_ko
    AND np_del_stavbe_deduplicated.stevilka_stavbe = ei_grouped.stevilka_stavbe
    AND np_del_stavbe_deduplicated.stevilka_dela_stavbe = ei_grouped.stevilka_dela_stavbe;

-- Posodobi KPP deduplicirane ei  
UPDATE core.kpp_del_stavbe_deduplicated 
SET energetske_izkaznice = ei_grouped.energetske_izkaznice
FROM (
    SELECT 
        ei.sifra_ko,
        ei.stevilka_stavbe,
        ei.stevilka_dela_stavbe,
        ARRAY_AGG(ei.id ORDER BY ei.datum_izdelave DESC) as energetske_izkaznice
    FROM core.energetska_izkaznica ei
    GROUP BY ei.sifra_ko, ei.stevilka_stavbe, ei.stevilka_dela_stavbe
) ei_grouped
WHERE kpp_del_stavbe_deduplicated.sifra_ko = ei_grouped.sifra_ko
    AND kpp_del_stavbe_deduplicated.stevilka_stavbe = ei_grouped.stevilka_stavbe
    AND kpp_del_stavbe_deduplicated.stevilka_dela_stavbe = ei_grouped.stevilka_dela_stavbe;