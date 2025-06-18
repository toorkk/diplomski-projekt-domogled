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
WHERE vrsta_dela_stavbe IS NOT NULL
AND sifra_ko IS NOT NULL 
AND stevilka_stavbe IS NOT NULL 
AND stevilka_dela_stavbe IS NOT NULL 
AND id_posla IS NOT NULL
