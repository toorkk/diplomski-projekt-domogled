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
povrsina_uporabna,
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
CASE 
    WHEN d.povrsina_dela_stavbe  > 0 THEN d.povrsina_dela_stavbe 
    ELSE NULL 
END as povrsina_uradna,
CASE 
    WHEN d.uporabna_povrsina_dela_stavbe  > 0 THEN d.uporabna_povrsina_dela_stavbe 
    ELSE NULL 
END as povrsina_uporabna,
d.prostori_dela_stavbe,
ST_Transform(ST_SetSRID(ST_MakePoint(d.e_centroid, d.n_centroid), 3794), 4326),
d.leto
FROM staging.np_del_stavbe d
WHERE d.vrsta_oddanih_prostorov IS NOT NULL
AND sifra_ko IS NOT NULL
AND stevilka_stavbe IS NOT NULL 
AND stevilka_dela_stavbe IS NOT NULL 
AND id_posla IS NOT NULL;


UPDATE core.np_del_stavbe 
SET tip_rabe = CASE 

    -- PODRTIJA
    WHEN dejanska_raba LIKE '%ruševina%'
        OR dejanska_raba LIKE '%neprimer%'
        OR dejanska_raba LIKE '%nedokončan%'
        THEN 'podrtija'

    WHEN dejanska_raba LIKE '%bivalna enota%'
        OR dejanska_raba LIKE '%oskrbo%'
        THEN 'drugo'

    
    -- BIVALNO
    WHEN dejanska_raba LIKE '%stanovanje%' 
        THEN 'bivalno'
        
    -- SHRAMBENO
    WHEN dejanska_raba LIKE '%klet%'
        OR dejanska_raba LIKE '%garaž%'
        OR dejanska_raba LIKE '%shramba%'
        OR dejanska_raba LIKE '%skladišče%'
        OR dejanska_raba LIKE '%1252002 - skladišča%'
        OR dejanska_raba LIKE '%parkir%'
        OR dejanska_raba LIKE '%kolesarnica%'
        OR dejanska_raba LIKE '%čolnarna%'
        OR dejanska_raba LIKE '%drvarnica%'
        OR dejanska_raba LIKE '%sušilnica%'
        OR dejanska_raba LIKE '%pralnica%'
        OR dejanska_raba LIKE '%senčnica%'
        OR dejanska_raba LIKE '%rezervoar%'
        OR dejanska_raba LIKE '%silos%'
        THEN 'shrambeno'
        
    -- POSLOVNO
    WHEN dejanska_raba LIKE '%poslovn%'
        OR dejanska_raba LIKE '%pisarn%'
        OR dejanska_raba LIKE '%kmetijski%'
        OR dejanska_raba LIKE '%trgov%'
        OR dejanska_raba LIKE '%prodajalna%'
        OR dejanska_raba LIKE '%industri%'
        OR dejanska_raba LIKE '%skladišč%'
        OR dejanska_raba LIKE '%restavracija%'
        OR dejanska_raba LIKE '%gostilna%'
        OR dejanska_raba LIKE '%spravilo pridelka%'
        OR dejanska_raba LIKE '%hotel%'
        OR dejanska_raba LIKE '%banka%'
        OR dejanska_raba LIKE '%pošta%'
        OR dejanska_raba LIKE '%zavarovalnica%'
        OR dejanska_raba LIKE '%proizvodnja%'
        OR dejanska_raba LIKE '%delavnica%'
        OR dejanska_raba LIKE '%hlev%'
        OR dejanska_raba LIKE '%farma%'
        OR dejanska_raba LIKE '%rastlinjak%'
        OR dejanska_raba LIKE '%zidanica%'
        OR dejanska_raba LIKE '%vinska klet%'
        OR dejanska_raba LIKE '%šola%'
        OR dejanska_raba LIKE '%vrtec%'
        OR dejanska_raba LIKE '%bolnica%'
        OR dejanska_raba LIKE '%ambulanta%'
        OR dejanska_raba LIKE '%zdravstvo%'
        OR dejanska_raba LIKE '%muzej%'
        OR dejanska_raba LIKE '%knjižnica%'
        OR dejanska_raba LIKE '%cerkev%'
        OR dejanska_raba LIKE '%športna dvorana%'
        OR dejanska_raba LIKE '%frizerski salon%'
        OR dejanska_raba LIKE '%avtosalon%'
        OR dejanska_raba LIKE '%bencinski servis%'
        OR dejanska_raba LIKE '%čebelnjak%'
        OR dejanska_raba LIKE '%apartma%'
        OR dejanska_raba LIKE '%motel%'
        OR dejanska_raba LIKE '%penzion%'
        OR dejanska_raba LIKE '%gostišče%'
        OR dejanska_raba LIKE '%koča%'
        OR dejanska_raba LIKE '%dom%'
        OR dejanska_raba LIKE '%bife%'
        OR dejanska_raba LIKE '%butik%'
        OR dejanska_raba LIKE '%lekarna%'
        OR dejanska_raba LIKE '%optika%'
        OR dejanska_raba LIKE '%klinika%'
        OR dejanska_raba LIKE '%dispanzer%'
        OR dejanska_raba LIKE '%sanatorij%'
        OR dejanska_raba LIKE '%veterinarska%'
        OR dejanska_raba LIKE '%nakupovalni center%'
        OR dejanska_raba LIKE '%sejemska dvorana%'
        OR dejanska_raba LIKE '%kiosk%'
        OR dejanska_raba LIKE '%avtopralnica%'
        OR dejanska_raba LIKE '%storitvene dejavnosti%'
        OR dejanska_raba LIKE '%igralnica%'
        OR dejanska_raba LIKE '%diskoteka%'
        OR dejanska_raba LIKE '%atelje%'
        THEN 'poslovno'
        
   ELSE 'drugo'
END
WHERE tip_rabe IS NULL OR LENGTH(TRIM(tip_rabe)) = 0;