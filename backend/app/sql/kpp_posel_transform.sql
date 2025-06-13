INSERT INTO core.kpp_posel (
    posel_id,
    vrsta_posla,
    datum_uveljavitve,
    datum_sklenitve,
    cena,
    vkljuceno_ddv,
    stopnja_ddv,
    opombe,
    trznost_posla,
    datum_zadnje_spremembe,
    datum_zadnje_uveljavitve,
    leto
)
SELECT
    id_posla,
    vrsta_kupoprodajnega_posla,
    TO_DATE(NULLIF(datum_uveljavitve, ''), 'DD.MM.YYYY'),
    TO_DATE(NULLIF(datum_sklenitve_pogodbe, ''), 'DD.MM.YYYY'),
    pogodbena_cena_odskodnina,
    CASE WHEN vkljucenost_ddv = 1 THEN TRUE ELSE FALSE END,
    stopnja_ddv,
    opombe_o_pravnem_poslu,
    trznost_posla,
    TO_DATE(NULLIF(datum_zadnje_spremembe_posla, ''), 'DD.MM.YYYY'),
    TO_DATE(NULLIF(datum_zadnje_uveljavitve_posla, ''), 'DD.MM.YYYY'),
    leto
FROM staging.kpp_posel;