-- =============================================================================
-- DEDUPLICIRANJE NP NEPREMIČNIN
-- =============================================================================
-- Namen: Ustvari en zapis za vsako nepremičnino (kombinacija sifra_ko, stevilka_stavbe, stevilka_dela_stavbe)
-- ki ima vsaj en zapis vrste 'stanovanje' ali 'hiša'
-- =============================================================================

INSERT INTO core.np_del_stavbe_deduplicated (
    sifra_ko, stevilka_stavbe, stevilka_dela_stavbe, dejanska_raba, vrsta_nepremicnine,
    obcina, naselje, ulica, hisna_stevilka, dodatek_hs, stev_stanovanja,
    povrsina_uradna, povrsina_uporabna,
    leto_izgradnje_stavbe, opremljenost,
    zadnja_najemnina, zadnje_vkljuceno_stroski, zadnje_vkljuceno_ddv, zadnja_stopnja_ddv, zadnje_leto,
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
    FROM core.np_del_stavbe
    WHERE vrsta_nepremicnine IN (1, 2) -- stanovanja in hise
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
        ARRAY_AGG(DISTINCT ds.posel_id ORDER BY ds.posel_id) as vsi_povezani_posel_ids
    FROM validne_nepremicnine vn
    INNER JOIN core.np_del_stavbe ds USING (sifra_ko, stevilka_stavbe, stevilka_dela_stavbe)
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
        ds.opremljenost,
        ds.coordinates,
        ds.posel_id as najnovejsi_posel_id
    FROM validne_nepremicnine vn
    INNER JOIN core.np_del_stavbe ds USING (sifra_ko, stevilka_stavbe, stevilka_dela_stavbe)
    WHERE ds.coordinates IS NOT NULL
    ORDER BY 
        vn.sifra_ko, vn.stevilka_stavbe, vn.stevilka_dela_stavbe,
        -- Prioriteta za izbiro "najnovejše" vrstice:
        CASE WHEN ds.vrsta_nepremicnine IN (1, 2) THEN 0 ELSE 1 END,  -- 1. vzami samo domove
        CASE WHEN ds.tip_rabe = 'bivalno' THEN 0 ELSE 1 END,  -- 1.2 vzami samo bivalne prostore
        ds.leto DESC,                                                                -- 2. najnovejše leto
        ds.del_stavbe_id DESC                                                       -- 3. najnovejši ID
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
    INNER JOIN core.np_del_stavbe ds_vsi ON ds_vsi.posel_id = ANY(vpn.vsi_povezani_posel_ids)
    GROUP BY vpn.sifra_ko, vpn.stevilka_stavbe, vpn.stevilka_dela_stavbe
),

-- KORAK 5: Najdi najnovejše podatke poslov
-- =========================================
zadnji_podatki_posel AS (
    SELECT DISTINCT ON (vpn.sifra_ko, vpn.stevilka_stavbe, vpn.stevilka_dela_stavbe)
        vpn.sifra_ko, 
        vpn.stevilka_stavbe, 
        vpn.stevilka_dela_stavbe,
        posel.najemnina as najnov_najemnina,
        posel.vkljuceno_stroski as najnov_vkljuceno_stroski,
        posel.vkljuceno_ddv as najnov_vkljuceno_ddv,
        posel.stopnja_ddv as najnov_stopnja_ddv,
        EXTRACT(YEAR FROM posel.datum_sklenitve) as najnov_leto_sklenitve
    FROM vsi_posel_ids_nepremicnine vpn
    INNER JOIN core.np_posel posel ON posel.posel_id = ANY(vpn.vsi_povezani_posel_ids) 
                                    AND posel.datum_sklenitve IS NOT NULL
    ORDER BY vpn.sifra_ko, vpn.stevilka_stavbe, vpn.stevilka_dela_stavbe,
             posel.datum_sklenitve DESC,
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
    nz.opremljenost,
    
    -- Podatki najnovejšega posla
    zpp.najnov_najemnina as zadnja_najemnina,
    zpp.najnov_vkljuceno_stroski as zadnje_vkljuceno_stroski,
    zpp.najnov_vkljuceno_ddv as zadnje_vkljuceno_ddv,
    zpp.najnov_stopnja_ddv as zadnja_stopnja_ddv, 
    zpp.najnov_leto_sklenitve as zadnje_leto,
    
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