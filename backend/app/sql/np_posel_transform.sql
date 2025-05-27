INSERT INTO core.np_posel (
    posel_id,
    vrsta_posla,

    datum_uveljavitve,
    datum_sklenitve,
    najemnina,
    vkljuceno_stroski,
    vkljuceno_ddv,
    stopnja_ddv,
    datum_zacetka_najemanja,
    datum_prenehanja_najemanja,
    cas_najemanja,
    trajanje_najemanja,
    datum_zakljucka_najema,
    opombe,
    posredovanje_agencije,
    datum_zadnje_spremembe,
    datum_zadnje_uveljavitve,
    vrsta_akta,
    trznost_posla,

    leto
)
SELECT
    p.id_posla,
    p.vrsta_najemnega_posla,

    TO_DATE(p.datum_uveljavitve, 'DD.MM.YYYY'),
    TO_DATE(p.datum_sklenitve_pogodbe, 'DD.MM.YYYY'),
    p.pogodbena_najemnina,
    CASE WHEN p.vkljucenost_obratovalnih_stroskov_v_najemnino = 1 THEN TRUE ELSE FALSE END,
    CASE WHEN p.vkljucenost_ddv = 1 THEN TRUE ELSE FALSE END,
    p.stopnja_ddv,
    TO_DATE(p.datum_zacetka_najema, 'DD.MM.YYYY'),
    TO_DATE(NULLIF(p.datum_prenehanja_najema, ''), 'DD.MM.YYYY'),
    p.cas_najema,
    p.trajanje_najema,
    TO_DATE(p.datum_zakljucka_najema_datum_predcasne_prekinitve_najema, 'DD.MM.YYYY'),
    p.opombe_o_pravnem_poslu,
    CASE WHEN p.posredovanje_nepremicninske_agencije = 1 THEN TRUE ELSE FALSE END,
    TO_DATE(p.datum_zadnje_spremembe_posla, 'DD.MM.YYYY'),
    TO_DATE(p.datum_zadnje_uveljavitve_posla, 'DD.MM.YYYY'),
    p.vrsta_akta,
    p.trznost_posla,

    p.leto
FROM staging.np_posel p;