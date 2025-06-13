WITH raba_mapping AS (
  SELECT dejanska_raba, category FROM (
    VALUES 
    -- STANOVANJE
    ('2 - stanovanje', 'stanovanje'),
    ('1122100 - stanovanje v večstanovanjski stavbi ali stanovanjsko poslovni stavbi', 'stanovanje'),
    ('47 - stanovanje v dvostanovanjski stavbi', 'stanovanje'),
    ('1121001 - stanovanje v samostoječi stavbi z dvema stanovanjema', 'stanovanje'),
    ('3 - oskrbovano stanovanje', 'stanovanje'),
    ('1122201 - oskrbovano stanovanje', 'stanovanje'),
    ('1121002 - stanovanje v krajni vrstni hiši z dvema stanovanjema', 'stanovanje'),
    ('1121003 - stanovanje v vmesni vrstni hiši z dvema stanovanjema', 'stanovanje'),
    ('1130001 - bivalna enota v stavbi za posebne namene', 'stanovanje'),
    ('4 - bivalna enota', 'stanovanje'),
    ('1211102 - apartma', 'stanovanje'),
    
    -- HISA 
    ('5 - koča, dom', 'hisa'),
    ('1212001 - koča, dom', 'hisa'),
    ('1 - stanovanje v enostanovanjski stavbi', 'hisa'),
    ('1110001 - stanovanje v samostoječi stavbi z enim stanovanjem', 'hisa'),
    ('1110002 - stanovanje, ki se nahaja v krajni vrstni hiši', 'hisa'),
    ('1110003 - stanovanje, ki se nahaja v vmesni vrstni hiši', 'hisa'),

    -- GARAZA
    ('15 - garaža', 'garaza'),
    ('16 - garažno parkirno mesto', 'garaza'),
    ('1242003 - pokrito parkirišče', 'garaza'),
    ('1242002 - garaža v garažni hiši', 'garaza'),
    ('1242002 - garaža', 'garaza'),
    ('1242001 - samostoječa garaža, vrstna garaža', 'garaza'),
    ('1242001 - garaža', 'garaza'),
    
    -- SHRAMBA
    ('33 - klet', 'shramba'),
    ('1274003 - klet', 'shramba'),
    ('34 - shramba, sušilnica, pralnica', 'shramba'),
    ('1274015 - shramba', 'shramba'),
    ('1274019 - sušilnica, pralnica', 'shramba'),
    ('1252003 - hladilnice in specializirana skladišča', 'shramba'),
    ('57 - drvarnica', 'shramba'),
    ('36 - tehnični prostor', 'shramba'),
    ('1274012 - kurilnica', 'shramba'),
    ('1274021 - podstrešje', 'shramba'),
    ('1274022 - ostali prostori stanovanja', 'shramba'),

    -- DRUGO
    ('1110000 - stanovanje, neprimerno za bivanje, v stavbi z enim stanovanjem', 'drugo'),
    ('1120000 - stanovanje, neprimerno za bivanje, v stavbi z dvema ali več stanovanji', 'drugo'),
    ('1120000 - nedokončano stanovanje v stavbi z več stanovanji', 'drugo'),
    ('1110000 - nedokončano stanovanje v stavbi z enim ali dvema stanovanjema', 'drugo')


  ) AS mapping(dejanska_raba, category)
)

INSERT INTO core.kpp_del_stavbe (
    posel_id,
    sifra_ko,
    ime_ko,
    obcina,
    stevilka_stavbe,
    stevilka_dela_stavbe,
    naselje,
    ulica,
    hisna_stevilka,
    dodatek_hs,
    stev_stanovanja,
    vrsta,
    leto_izgradnje_stavbe,
    stavba_je_dokoncana,
    gradbena_faza,
    novogradnja,
    prodani_delez,
    nadstropje,
    opombe,
    dejanska_raba,
    tip_nepremicnine,
    lega_v_stavbi,
    stevilo_sob,
    povrsina_uradna,
    povrsina_pogodba,
    prostori,
    pogodbena_cena,
    stopnja_ddv,
    coordinates,
    leto
)
SELECT
    id_posla,
    sifra_ko,
    TRIM(ime_ko) as ime_ko,
    UPPER(TRIM(obcina)) as obcina,
    stevilka_stavbe as stevilka_stavbe,
    stevilka_dela_stavbe as stevilka_dela_stavbe,
    UPPER(TRIM(naselje)) as naselje,
    UPPER(TRIM(ulica)) as ulica,
    CASE 
        WHEN hisna_stevilka IS NULL OR TRIM(hisna_stevilka) = '' THEN NULL
        WHEN hisna_stevilka ~ '^-?\d+\.?\d*$' THEN CAST(CAST(hisna_stevilka AS NUMERIC) AS INTEGER)
        ELSE NULL 
    END as hisna_stevilka,
    CASE 
        WHEN dodatek_hs IS NULL OR TRIM(dodatek_hs) = '' THEN NULL
        WHEN dodatek_hs ~ '^[A-Za-z0-9]+$' THEN UPPER(TRIM(dodatek_hs))
        ELSE NULL
    END as dodatek_hs,
    stevilka_stanovanja_ali_poslovnega_prostora,
    vrsta_dela_stavbe,
    CASE 
        WHEN leto_izgradnje_dela_stavbe BETWEEN 1500 AND EXTRACT(YEAR FROM CURRENT_DATE) 
            THEN leto_izgradnje_dela_stavbe
        ELSE NULL 
    END as leto_izgradnje_stavbe,   
    stavba_je_dokoncana,
    gradbena_faza,
    novogradnja,
    prodani_delez_dela_stavbe,
    CAST(CAST(nadstropje_dela_stavbe AS NUMERIC) AS INTEGER) as nadstropje_dela_stavbe,
    TRIM(opombe_o_nepremicnini) as opombe_o_nepremicnini,
    LOWER(TRIM(dejanska_raba_dela_stavbe)) as dejanska_raba_dela_stavbe,
    COALESCE(rm.category, 'neopredeljeno') as tip_nepremicnine,
    LOWER(TRIM(lega_dela_stavbe_v_stavbi)) as lega_dela_stavbe_v_stavbi,
    stevilo_sob,
    povrsina_dela_stavbe as povrsina_uradna,
    COALESCE(
        prodana_povrsina_dela_stavbe, 
        prodana_povrsina
    ) as povrsina_pogodba,
    prostori_dela_stavbe,
    pogodbena_cena_dela_stavbe,
    stopnja_ddv_dela_stavbe,
    ST_Transform(ST_SetSRID(ST_MakePoint(e_centroid, n_centroid), 3794), 4326),    -- Convert Slovenian coordinate system (D48/GK) to WGS84
    leto
FROM staging.kpp_del_stavbe
LEFT JOIN raba_mapping rm ON LOWER(TRIM(dejanska_raba_dela_stavbe)) = rm.dejanska_raba
WHERE vrsta_dela_stavbe IS NOT NULL --IN (1, 2, 3, 4) 
AND sifra_ko IS NOT NULL 
AND stevilka_stavbe IS NOT NULL 
AND stevilka_dela_stavbe IS NOT NULL 
AND id_posla IS NOT NULL
