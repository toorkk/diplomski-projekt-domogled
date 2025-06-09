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


INSERT INTO core.np_del_stavbe (
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
opremljenost,

opombe,
leto_izgradnje_stavbe,
dejanska_raba,
tip_nepremicnine,
lega_v_stavbi,

povrsina_uradna,
povrsina_pogodba,
povrsina_uporabna_uradna,
povrsina_uporabna_pogodba, 
prostori,

coordinates, 
leto
)
SELECT
d.id_posla,
d.sifra_ko,
TRIM(d.ime_ko) as ime_ko,
UPPER(TRIM(d.obcina)) as obcina,
d.stevilka_stavbe as stevilka_stavbe,
d.stevilka_dela_stavbe as stevilka_dela_stavbe,

UPPER(TRIM(d.naselje)) as naselje,
UPPER(TRIM(d.ulica)) as ulica,
CASE 
    WHEN d.hisna_stevilka IS NULL OR TRIM(d.hisna_stevilka) = '' THEN NULL
    WHEN d.hisna_stevilka ~ '^-?\d+\.?\d*$' THEN CAST(CAST(d.hisna_stevilka AS NUMERIC) AS INTEGER)
    ELSE NULL 
END as hisna_stevilka,
CASE 
    WHEN d.dodatek_hs IS NULL OR TRIM(d.dodatek_hs) = '' THEN NULL
    WHEN d.dodatek_hs ~ '^[A-Za-z0-9]+$' THEN UPPER(TRIM(d.dodatek_hs))
    ELSE NULL
END as dodatek_hs,
d.stevilka_stanovanja_ali_poslovnega_prostora,
d.vrsta_oddanih_prostorov,
d.opremljenost_oddanih_prostorov,

TRIM(d.opombe_o_oddanih_prostorih) as opombe_o_oddanih_prostorih,
CASE 
    WHEN d.leto_izgradnje_stavbe BETWEEN 1500 AND EXTRACT(YEAR FROM CURRENT_DATE) 
        THEN d.leto_izgradnje_stavbe
    ELSE NULL 
END as leto_izgradnje_stavbe,  
LOWER(TRIM(d.dejanska_raba_dela_stavbe)) as dejanska_raba,
COALESCE(rm.category, 'neopredeljeno') as tip_nepremicnine,
LOWER(TRIM(d.lega_dela_stavbe_v_stavbi)) as lega_v_stavbi,

d.povrsina_dela_stavbe as povrsina_uradna,
COALESCE(
    d.povrsina_oddanih_prostorov,
    d.povrsina_dela_stavbe  -- če je oddan cel del stavbe
) as povrsina_pogodba,
d.uporabna_povrsina_dela_stavbe as povrsina_uporabna_uradna,
COALESCE(
    d.uporabna_povrsina_oddanih_prostorov,
    d.uporabna_povrsina_dela_stavbe  -- če je oddan cel del stavbe
) as povrsina_uporabna_pogodba,
d.prostori_dela_stavbe,

ST_Transform(ST_SetSRID(ST_MakePoint(d.e_centroid, d.n_centroid), 3794), 4326),
d.leto
FROM staging.np_del_stavbe d
LEFT JOIN raba_mapping rm ON LOWER(TRIM(d.dejanska_raba_dela_stavbe)) = rm.dejanska_raba
WHERE d.vrsta_oddanih_prostorov IS NOT NULL --IN (1, 2, 3, 4) 
AND sifra_ko IS NOT NULL 
AND stevilka_stavbe IS NOT NULL 
AND stevilka_dela_stavbe IS NOT NULL 
AND id_posla IS NOT NULL 