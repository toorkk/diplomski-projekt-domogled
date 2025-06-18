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
vrsta_nepremicnine,
opremljenost,

opombe,
leto_izgradnje_stavbe,
dejanska_raba,
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
WHERE d.vrsta_oddanih_prostorov IS NOT NULL
AND sifra_ko IS NOT NULL 
AND stevilka_stavbe IS NOT NULL 
AND stevilka_dela_stavbe IS NOT NULL 
AND id_posla IS NOT NULL 