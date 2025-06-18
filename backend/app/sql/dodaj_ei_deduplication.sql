-- =======================================================================
-- POSODOBITEV ENERGETSKIH IZKAZNIC V DEDUPLICIRANIH TABELAH
-- =======================================================================
-- Logika:
-- 1. Specifične energetske izkaznice (stevilka_dela_stavbe != 0) se dodelijo točno določenemu delu stavbe
-- 2. Splošne energetske izkaznice (stevilka_dela_stavbe = 0) se dodelijo vsem delom stavbe
-- 3. Če ima del stavbe oboje, se kombinirajo v en array
-- =======================================================================

-- -----------------------------------------------------------------------
-- 1. POSODOBITEV NP DEDUPLICIRANE TABELE
-- -----------------------------------------------------------------------

UPDATE core.np_del_stavbe_deduplicated 
SET 
    energetske_izkaznice = ei_combined.energetske_izkaznice,
    energijski_razred = ei_combined.energijski_razred
FROM (
    
    -- Specifične energetske izkaznice
    SELECT 
        ei.sifra_ko,
        ei.stevilka_stavbe,
        ei.stevilka_dela_stavbe,
        ARRAY_AGG(ei.id ORDER BY ei.datum_izdelave DESC) as energetske_izkaznice,
        (ARRAY_AGG(ei.energijski_razred ORDER BY ei.datum_izdelave DESC))[1] as energijski_razred
    FROM core.energetska_izkaznica ei
    WHERE ei.stevilka_dela_stavbe != 0  
    GROUP BY ei.sifra_ko, ei.stevilka_stavbe, ei.stevilka_dela_stavbe
    
    UNION ALL
    
    -- Splošne energetske izkaznice
    -- Dodelijo se vsem delom stavbe, kjer se ujemata sifra_ko in stevilka_stavbe
    SELECT 
        del_stavbe.sifra_ko,
        del_stavbe.stevilka_stavbe,
        del_stavbe.stevilka_dela_stavbe,
        ei_celotna_stavba.energetske_izkaznice,
        ei_celotna_stavba.energijski_razred
    FROM core.np_del_stavbe_deduplicated del_stavbe
    INNER JOIN (
        -- Pripravi energetske izkaznice za celotne stavbe
        SELECT 
            ei.sifra_ko,
            ei.stevilka_stavbe,
            ARRAY_AGG(ei.id ORDER BY ei.datum_izdelave DESC) as energetske_izkaznice,
            (ARRAY_AGG(ei.energijski_razred ORDER BY ei.datum_izdelave DESC))[1] as energijski_razred
        FROM core.energetska_izkaznica ei
        WHERE ei.stevilka_dela_stavbe = 0  
        GROUP BY ei.sifra_ko, ei.stevilka_stavbe
    ) ei_celotna_stavba ON (
        del_stavbe.sifra_ko = ei_celotna_stavba.sifra_ko 
        AND del_stavbe.stevilka_stavbe = ei_celotna_stavba.stevilka_stavbe
    )
    
) ei_combined
WHERE np_del_stavbe_deduplicated.sifra_ko = ei_combined.sifra_ko
    AND np_del_stavbe_deduplicated.stevilka_stavbe = ei_combined.stevilka_stavbe
    AND np_del_stavbe_deduplicated.stevilka_dela_stavbe = ei_combined.stevilka_dela_stavbe;


-- -----------------------------------------------------------------------
-- 2. POSODOBITEV KPP DEDUPLICIRANE TABELE
-- -----------------------------------------------------------------------

UPDATE core.kpp_del_stavbe_deduplicated 
SET 
    energetske_izkaznice = ei_combined.energetske_izkaznice,
    energijski_razred = ei_combined.energijski_razred
FROM (
    
    -- Specifične energetske izkaznice
    SELECT 
        ei.sifra_ko,
        ei.stevilka_stavbe,
        ei.stevilka_dela_stavbe,
        ARRAY_AGG(ei.id ORDER BY ei.datum_izdelave DESC) as energetske_izkaznice,
        (ARRAY_AGG(ei.energijski_razred ORDER BY ei.datum_izdelave DESC))[1] as energijski_razred
    FROM core.energetska_izkaznica ei
    WHERE ei.stevilka_dela_stavbe != 0  
    GROUP BY ei.sifra_ko, ei.stevilka_stavbe, ei.stevilka_dela_stavbe
    
    UNION ALL
    
    -- Splošne energetske izkaznice
    -- Dodelijo se vsem delom stavbe, kjer se ujemata sifra_ko in stevilka_stavbe
    SELECT 
        del_stavbe.sifra_ko,
        del_stavbe.stevilka_stavbe,
        del_stavbe.stevilka_dela_stavbe,
        ei_celotna_stavba.energetske_izkaznice,
        ei_celotna_stavba.energijski_razred
    FROM core.kpp_del_stavbe_deduplicated del_stavbe
    INNER JOIN (
        -- Pripravi energetske izkaznice za celotne stavbe
        SELECT 
            ei.sifra_ko,
            ei.stevilka_stavbe,
            ARRAY_AGG(ei.id ORDER BY ei.datum_izdelave DESC) as energetske_izkaznice,
            (ARRAY_AGG(ei.energijski_razred ORDER BY ei.datum_izdelave DESC))[1] as energijski_razred
        FROM core.energetska_izkaznica ei
        WHERE ei.stevilka_dela_stavbe = 0  
        GROUP BY ei.sifra_ko, ei.stevilka_stavbe
    ) ei_celotna_stavba ON (
        del_stavbe.sifra_ko = ei_celotna_stavba.sifra_ko 
        AND del_stavbe.stevilka_stavbe = ei_celotna_stavba.stevilka_stavbe
    )
    
) ei_combined
WHERE kpp_del_stavbe_deduplicated.sifra_ko = ei_combined.sifra_ko
    AND kpp_del_stavbe_deduplicated.stevilka_stavbe = ei_combined.stevilka_stavbe
    AND kpp_del_stavbe_deduplicated.stevilka_dela_stavbe = ei_combined.stevilka_dela_stavbe;