-- Indeksi za LIKE pogoje
CREATE INDEX IF NOT EXISTS idx_dejanska_raba_gin ON core.kpp_del_stavbe 
USING gin (dejanska_raba gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_tip_rabe ON core.kpp_del_stavbe (tip_rabe) 
WHERE tip_rabe IS NULL OR LENGTH(TRIM(tip_rabe)) = 0;

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
    vrsta_nepremicnine,
    leto_izgradnje_stavbe,
    stavba_je_dokoncana,
    gradbena_faza,
    novogradnja,
    prodani_delez,
    nadstropje,
    opombe,
    dejanska_raba,
    lega_v_stavbi,
    stevilo_sob,
    povrsina_uradna,
    povrsina_uporabna,
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
    LOWER(TRIM(lega_dela_stavbe_v_stavbi)) as lega_dela_stavbe_v_stavbi,
    stevilo_sob,
    CASE 
        WHEN povrsina_dela_stavbe  > 0 THEN povrsina_dela_stavbe 
        ELSE NULL 
    END as povrsina_uradna,
    CASE 
        WHEN uporabna_povrsina  > 0 THEN uporabna_povrsina 
        ELSE NULL 
    END as povrsina_uporabna,
    prostori_dela_stavbe,
    pogodbena_cena_dela_stavbe,
    stopnja_ddv_dela_stavbe,
    ST_Transform(ST_SetSRID(ST_MakePoint(e_centroid, n_centroid), 3794), 4326),    -- Convert Slovenian coordinate system (D48/GK) to WGS84
    leto
FROM staging.kpp_del_stavbe
WHERE vrsta_dela_stavbe IS NOT NULL
AND sifra_ko IS NOT NULL 
AND stevilka_stavbe IS NOT NULL 
AND stevilka_dela_stavbe IS NOT NULL 
AND id_posla IS NOT NULL
AND (opombe_o_nepremicnini IS NULL OR opombe_o_nepremicnini NOT ILIKE '%prodani solastniški deleži%');

-- NOSONAR: LIKE conditions optimized with GIN trigram index (idx_dejanska_raba_gin)
UPDATE core.kpp_del_stavbe 
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