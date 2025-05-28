INSERT INTO core.kpp_del_stavbe_deduplicated (
    sifra_ko,
    stevilka_stavbe,
    stevilka_dela_stavbe,
    dejanska_raba,
    obcina,
    naselje,
    ulica,
    hisna_stevilka,
    dodatek_hs,
    stev_stanovanja,
    povrsina,
    povrsina_uporabna,
    leto_izgradnje_stavbe,
    stevilo_sob,
    zadnja_cena,
    zadnje_vkljuceno_ddv,
    zadnja_stopnja_ddv,
    zadnje_leto,
    povezani_del_stavbe_ids,
    povezani_posel_ids,
    najnovejsi_del_stavbe_id,
    coordinates
)
WITH normalized_data AS (
    SELECT 
        ds.sifra_ko,
        ds.stevilka_stavbe,
        ds.stevilka_dela_stavbe,
        COALESCE(NULLIF(TRIM(ds.dejanska_raba), ''), 'neznano') as dejanska_raba,
        ds.leto,
        ds.del_stavbe_id,
        ds.posel_id,
        ds.coordinates,
        ds.obcina,
        ds.naselje,
        ds.ulica,
        ds.hisna_stevilka,
        ds.dodatek_hs,
        ds.stev_stanovanja,
        ds.povrsina,
        ds.povrsina_uporabna,
        ds.leto_izgradnje_stavbe,
        ds.stevilo_sob,
        -- Dodaj row number za določitev najnovejšega zapisa
        ROW_NUMBER() OVER (
            PARTITION BY ds.sifra_ko, ds.stevilka_stavbe, ds.stevilka_dela_stavbe, 
                        COALESCE(NULLIF(TRIM(ds.dejanska_raba), ''), 'neznano')
            ORDER BY ds.leto DESC, ds.del_stavbe_id DESC
        ) as rn
    FROM core.kpp_del_stavbe ds
    WHERE ds.coordinates IS NOT NULL
      AND ds.sifra_ko IS NOT NULL
      AND ds.stevilka_stavbe IS NOT NULL
      AND ds.stevilka_dela_stavbe IS NOT NULL
),
latest_contracts AS (
    SELECT 
        nd.sifra_ko,
        nd.stevilka_stavbe,
        nd.stevilka_dela_stavbe,
        nd.dejanska_raba,
        p.cena,
        p.vkljuceno_ddv,
        p.stopnja_ddv,
        p.leto,
        ROW_NUMBER() OVER (
            PARTITION BY nd.sifra_ko, nd.stevilka_stavbe, nd.stevilka_dela_stavbe, nd.dejanska_raba
            ORDER BY p.datum_sklenitve DESC, p.posel_id DESC
        ) as contract_rn
    FROM normalized_data nd
    INNER JOIN core.kpp_posel p ON nd.posel_id = p.posel_id
    WHERE p.datum_sklenitve IS NOT NULL
)
SELECT 
    nd.sifra_ko,
    nd.stevilka_stavbe,
    nd.stevilka_dela_stavbe,
    nd.dejanska_raba,
    -- del_stavbe fields iz najnovejšega dela stavbe
    (ARRAY_AGG(nd.obcina ORDER BY nd.rn ASC))[1] as obcina,
    (ARRAY_AGG(nd.naselje ORDER BY nd.rn ASC))[1] as naselje,
    (ARRAY_AGG(nd.ulica ORDER BY nd.rn ASC))[1] as ulica,
    (ARRAY_AGG(nd.hisna_stevilka ORDER BY nd.rn ASC))[1] as hisna_stevilka,
    (ARRAY_AGG(nd.dodatek_hs ORDER BY nd.rn ASC))[1] as dodatek_hs,
    (ARRAY_AGG(nd.stev_stanovanja ORDER BY nd.rn ASC))[1] as stev_stanovanja,
    (ARRAY_AGG(nd.povrsina ORDER BY nd.rn ASC))[1] as povrsina,
    (ARRAY_AGG(nd.povrsina_uporabna ORDER BY nd.rn ASC))[1] as povrsina_uporabna,
    (ARRAY_AGG(nd.leto_izgradnje_stavbe ORDER BY nd.rn ASC))[1] as leto_izgradnje_stavbe,
    (ARRAY_AGG(nd.stevilo_sob ORDER BY nd.rn ASC))[1] as stevilo_sob,
    -- podatki zadnjega posla
    lc.cena as zadnja_cena,
    lc.vkljuceno_ddv as zadnje_vkljuceno_ddv,
    lc.stopnja_ddv as zadnja_stopnja_ddv,
    lc.leto as zadnje_leto,
    -- povezani posli in deli stavb
    ARRAY_AGG(DISTINCT nd.del_stavbe_id ORDER BY nd.del_stavbe_id) as povezani_del_stavbe_ids,
    ARRAY_AGG(DISTINCT nd.posel_id ORDER BY nd.posel_id) as povezani_posel_ids,
    (ARRAY_AGG(nd.del_stavbe_id ORDER BY nd.rn ASC))[1] as najnovejsi_del_stavbe_id,
    (ARRAY_AGG(nd.coordinates ORDER BY nd.rn ASC))[1] as coordinates
FROM normalized_data nd
LEFT JOIN latest_contracts lc ON (
    nd.sifra_ko = lc.sifra_ko 
    AND nd.stevilka_stavbe = lc.stevilka_stavbe 
    AND nd.stevilka_dela_stavbe = lc.stevilka_dela_stavbe 
    AND nd.dejanska_raba = lc.dejanska_raba 
    AND lc.contract_rn = 1
)
GROUP BY nd.sifra_ko, nd.stevilka_stavbe, nd.stevilka_dela_stavbe, nd.dejanska_raba,
         lc.cena, lc.vkljuceno_ddv, lc.stopnja_ddv, lc.leto;