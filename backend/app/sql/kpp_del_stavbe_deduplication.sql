-- =============================================================================
-- DEDUPLICIRANJE KPP NEPREMIČNIN 
-- =============================================================================
-- Namen: Ustvari en zapis za vsako nepremičnino (kombinacija sifra_ko, stevilka_stavbe, stevilka_dela_stavbe)
-- ki ima vsaj en zapis vrste 'stanovanje' ali 'hiša'
-- =============================================================================

SET work_mem = '512MB';
SET maintenance_work_mem = '1GB';
SET temp_buffers = '128MB';

INSERT INTO core.kpp_del_stavbe_deduplicated (
    sifra_ko, stevilka_stavbe, stevilka_dela_stavbe, dejanska_raba, vrsta_nepremicnine,
    obcina, naselje, ulica, hisna_stevilka, dodatek_hs, stev_stanovanja,
    povrsina_uradna, povrsina_uporabna, leto_izgradnje_stavbe,
    zadnja_cena, zadnje_vkljuceno_ddv, zadnja_stopnja_ddv, zadnje_leto,
    zadnje_stevilo_delov_stavb,
    povezani_del_stavbe_ids, povezani_posel_ids, najnovejsi_del_stavbe_id, coordinates
)
WITH 

-- KORAK 1: Najdi vse veljavne nepremičnine
-- ========================================
validne_nepremicnine AS (
    SELECT DISTINCT 
        sifra_ko, 
        stevilka_stavbe, 
        stevilka_dela_stavbe
    FROM core.kpp_del_stavbe
    WHERE vrsta_nepremicnine IN (1, 2)
      AND tip_rabe = 'bivalno' -- vzami samo bivalne (ker so stanovanja in hise ki so steti kot npr vrteci)
      -- AND coordinates IS NOT NULL
      AND sifra_ko IS NOT NULL
      AND stevilka_stavbe IS NOT NULL 
      AND stevilka_dela_stavbe IS NOT NULL
),

-- KORAK 2: Zberi vse posel_ids za vsako nepremičnino
-- ===================================================================
vsi_posel_ids_nepremicnine AS (
    SELECT 
        vn.sifra_ko,
        vn.stevilka_stavbe, 
        vn.stevilka_dela_stavbe,
        ARRAY_AGG(ds.posel_id ORDER BY 
            p.datum_sklenitve DESC NULLS LAST,
            p.datum_uveljavitve DESC NULLS LAST,
            ds.posel_id DESC
        ) as vsi_povezani_posel_ids
    FROM validne_nepremicnine vn
    INNER JOIN core.kpp_del_stavbe ds USING (sifra_ko, stevilka_stavbe, stevilka_dela_stavbe)
    INNER JOIN core.kpp_posel p ON ds.posel_id = p.posel_id
    GROUP BY vn.sifra_ko, vn.stevilka_stavbe, vn.stevilka_dela_stavbe
),

-- KORAK 3: Najdi najnovejšo vrstico za vsako nepremičnino
-- =======================================================
najnovejsi_zapisi AS (
    SELECT DISTINCT ON (vn.sifra_ko, vn.stevilka_stavbe, vn.stevilka_dela_stavbe)
        vn.sifra_ko,
        vn.stevilka_stavbe, 
        vn.stevilka_dela_stavbe,
        ds.del_stavbe_id as najnovejsi_del_stavbe_id,
        ds.dejanska_raba,
        ds.vrsta_nepremicnine,
        ds.obcina,
        ds.naselje,
        ds.ulica,
        ds.hisna_stevilka,
        ds.dodatek_hs,
        ds.stev_stanovanja,
        ds.povrsina_uradna,
        ds.povrsina_uporabna,
        ds.leto_izgradnje_stavbe,
        ds.coordinates,
        ds.posel_id as najnovejsi_posel_id
    FROM validne_nepremicnine vn
    INNER JOIN core.kpp_del_stavbe ds USING (sifra_ko, stevilka_stavbe, stevilka_dela_stavbe)
    INNER JOIN core.kpp_posel p ON ds.posel_id = p.posel_id
    WHERE ds.coordinates IS NOT NULL
    ORDER BY 
        vn.sifra_ko, vn.stevilka_stavbe, vn.stevilka_dela_stavbe,
        -- Prioriteta za izbiro "najnovejše" vrstice:
        CASE WHEN ds.vrsta_nepremicnine IN (1, 2) THEN 0 ELSE 1 END,  -- 1. vzami samo domove
        CASE WHEN ds.tip_rabe = 'bivalno' THEN 0 ELSE 1 END,  -- 1.2 vzami samo bivalne prostore
        p.datum_sklenitve DESC NULLS LAST,
        p.datum_uveljavitve DESC NULLS LAST,
        ds.posel_id DESC
),

-- KORAK 4: Najdi vse povezane dele stavb preko poslov
-- ===================================================
vsi_povezani_del_stavbe AS (
    SELECT 
        vpn.sifra_ko, 
        vpn.stevilka_stavbe, 
        vpn.stevilka_dela_stavbe,
        ARRAY_AGG(DISTINCT ds_vsi.del_stavbe_id ORDER BY ds_vsi.del_stavbe_id) as vsi_povezani_del_stavbe_ids
    FROM vsi_posel_ids_nepremicnine vpn
    INNER JOIN core.kpp_del_stavbe ds_vsi ON ds_vsi.posel_id = ANY(vpn.vsi_povezani_posel_ids)
    GROUP BY vpn.sifra_ko, vpn.stevilka_stavbe, vpn.stevilka_dela_stavbe
),

-- KORAK 5: Najdi najnovejše podatke poslov
-- ===============================================================
zadnji_podatki_posel AS (
    SELECT DISTINCT ON (vpn.sifra_ko, vpn.stevilka_stavbe, vpn.stevilka_dela_stavbe)
        vpn.sifra_ko, 
        vpn.stevilka_stavbe, 
        vpn.stevilka_dela_stavbe,
        posel.cena as najnov_cena,
        posel.vkljuceno_ddv as najnov_vkljuceno_ddv,
        posel.stopnja_ddv as najnov_stopnja_ddv,
        EXTRACT(YEAR FROM posel.datum_sklenitve) as najnov_leto_sklenitve,
        posel.posel_id as najnov_posel_id,
        -- Preštej dele stavb za najnovejši posel
        (SELECT COUNT(DISTINCT ds_count.del_stavbe_id) 
         FROM core.kpp_del_stavbe ds_count 
         WHERE ds_count.posel_id = posel.posel_id)  as najnov_stevilo_delov_stavb
    FROM vsi_posel_ids_nepremicnine vpn
    INNER JOIN core.kpp_posel posel ON posel.posel_id = ANY(vpn.vsi_povezani_posel_ids) 
                                    AND posel.datum_sklenitve IS NOT NULL
    ORDER BY vpn.sifra_ko, vpn.stevilka_stavbe, vpn.stevilka_dela_stavbe,
        posel.datum_sklenitve DESC NULLS LAST,
        posel.datum_uveljavitve DESC NULLS LAST,
        posel.posel_id DESC
),

-- KORAK 6: Identificiraj podvojene najnovejše posle
-- =================================================
podvojeni_zadnji_posli AS (
    SELECT najnovejsi_posel_id
    FROM najnovejsi_zapisi
    GROUP BY najnovejsi_posel_id
    HAVING COUNT(*) > 1
)

-- KONČNI REZULTAT
-- ===============
SELECT 
    -- Identifikatorji
    nz.sifra_ko,
    nz.stevilka_stavbe, 
    nz.stevilka_dela_stavbe,
    
    -- Podatki iz najnovejše vrstice
    nz.dejanska_raba,
    nz.vrsta_nepremicnine,
    
    -- Lokacija
    nz.obcina,
    nz.naselje, 
    nz.ulica,
    nz.hisna_stevilka,
    CASE 
        WHEN pzp.najnovejsi_posel_id IS NOT NULL 
        THEN nz.dodatek_hs || ' PODV.'
        ELSE nz.dodatek_hs 
    END as dodatek_hs,
    nz.stev_stanovanja,
    
    -- Tehnični podatki
    nz.povrsina_uradna,
    nz.povrsina_uporabna, 
    nz.leto_izgradnje_stavbe,
    
    -- Podatki najnovejšega posla
    zpp.najnov_cena as zadnja_cena,
    zpp.najnov_vkljuceno_ddv as zadnje_vkljuceno_ddv,
    zpp.najnov_stopnja_ddv as zadnja_stopnja_ddv, 
    zpp.najnov_leto_sklenitve as zadnje_leto,
    zpp.najnov_stevilo_delov_stavb as zadnje_stevilo_delov_stavb,
    
    -- Povezave
    vpds.vsi_povezani_del_stavbe_ids as povezani_del_stavbe_ids,
    vpn.vsi_povezani_posel_ids as povezani_posel_ids,
    nz.najnovejsi_del_stavbe_id,
    
    -- Koordinate
    nz.coordinates

FROM najnovejsi_zapisi nz
LEFT JOIN vsi_posel_ids_nepremicnine vpn USING (sifra_ko, stevilka_stavbe, stevilka_dela_stavbe)
LEFT JOIN vsi_povezani_del_stavbe vpds USING (sifra_ko, stevilka_stavbe, stevilka_dela_stavbe)
LEFT JOIN zadnji_podatki_posel zpp USING (sifra_ko, stevilka_stavbe, stevilka_dela_stavbe)
LEFT JOIN podvojeni_zadnji_posli pzp ON nz.najnovejsi_posel_id = pzp.najnovejsi_posel_id

ORDER BY nz.sifra_ko, nz.stevilka_stavbe, nz.stevilka_dela_stavbe;