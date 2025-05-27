INSERT INTO core.kpp_del_stavbe_deduplicated (
    sifra_ko,
    stevilka_stavbe,
    stevilka_dela_stavbe,
    dejanska_raba,
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
        -- Dodaj row number za določitev najnovejšega zapisa
        ROW_NUMBER() OVER (
            PARTITION BY ds.sifra_ko, ds.stevilka_stavbe, ds.stevilka_dela_stavbe
            ORDER BY ds.leto DESC, ds.del_stavbe_id DESC
        ) as rn
    FROM core.kpp_del_stavbe ds
    WHERE ds.coordinates IS NOT NULL
      AND ds.sifra_ko IS NOT NULL
      AND ds.stevilka_stavbe IS NOT NULL
      AND ds.stevilka_dela_stavbe IS NOT NULL
)
-- Ne filtriraj podatkov - vzemi VSE zapise za agregacijo
SELECT 
    sifra_ko,
    stevilka_stavbe,
    stevilka_dela_stavbe,
    -- Vzemi dejanska_raba iz najnovejšega zapisa
    (ARRAY_AGG(dejanska_raba ORDER BY rn ASC))[1] as dejanska_raba,
    ARRAY_AGG(DISTINCT del_stavbe_id ORDER BY del_stavbe_id) as povezani_del_stavbe_ids,
    ARRAY_AGG(DISTINCT posel_id ORDER BY posel_id) as povezani_posel_ids,
    -- Vzemi najnovejši del_stavbe_id (kjer je rn = 1)
    (ARRAY_AGG(del_stavbe_id ORDER BY rn ASC))[1] as najnovejsi_del_stavbe_id,
    -- Vzemi koordinate najnovejšega zapisa
    (ARRAY_AGG(coordinates ORDER BY rn ASC))[1] as coordinates
FROM normalized_data
GROUP BY sifra_ko, stevilka_stavbe, stevilka_dela_stavbe;