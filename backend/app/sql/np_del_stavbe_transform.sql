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
lega_v_stavbi,

povrsina, 
povrsina_uporabna, 
prostori,

coordinates, 
leto
)
SELECT
d.id_posla,
d.sifra_ko,
TRIM(d.ime_ko) as ime_ko,
TRIM(d.obcina) as obcina,
d.stevilka_stavbe,
d.stevilka_dela_stavbe,

TRIM(d.naselje) as naselje,
d.ulica,
d.hisna_stevilka,
d.dodatek_hs,
d.stevilka_stanovanja_ali_poslovnega_prostora,
d.vrsta_oddanih_prostorov,
d.opremljenost_oddanih_prostorov,

d.opombe_o_oddanih_prostorih,
d.leto_izgradnje_stavbe,
LOWER(TRIM(d.dejanska_raba_dela_stavbe)) as dejanska_raba,
LOWER(TRIM(d.lega_dela_stavbe_v_stavbi)) as lega_v_stavbi,

d.povrsina_dela_stavbe,
d.uporabna_povrsina_dela_stavbe,
d.prostori_dela_stavbe,

ST_Transform(ST_SetSRID(ST_MakePoint(d.e_centroid, d.n_centroid), 3794), 4326),
d.leto
FROM staging.np_del_stavbe d
WHERE d.vrsta_oddanih_prostorov IN (1, 2) AND sifra_ko IS NOT NULL AND stevilka_stavbe IS NOT NULL AND stevilka_dela_stavbe IS NOT NULL AND id_posla IS NOT NULL