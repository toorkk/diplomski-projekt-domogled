CREATE SCHEMA IF NOT EXISTS staging;


DROP TABLE IF EXISTS staging.kpp_sifrant;
CREATE TABLE staging.kpp_sifrant (
    id INTEGER,
    sifrant VARCHAR(100),
    numericna_vrednost INTEGER,
    opis TEXT
);


DROP TABLE IF EXISTS staging.kpp_del_stavbe;
CREATE TABLE staging.kpp_del_stavbe (
    id_posla INTEGER,
    sifra_ko INTEGER,
    ime_ko VARCHAR(100),
    obcina VARCHAR(100),
    stevilka_stavbe INTEGER,
    stevilka_dela_stavbe INTEGER,
    parcelna_stevilka_za_geolokacijo VARCHAR(50),
    interna_oznaka_dela_stavbe VARCHAR(100),
    evidentiranost_dela_stavbe INTEGER,
    naselje VARCHAR(100),
    ulica VARCHAR(100),
    hisna_stevilka VARCHAR(20),
    dodatek_hs VARCHAR(10),
    stevilka_stanovanja_ali_poslovnega_prostora INTEGER,
    vrsta_dela_stavbe INTEGER,
    leto_izgradnje_dela_stavbe INTEGER,
    stavba_je_dokoncana INTEGER,
    gradbena_faza INTEGER,
    novogradnja INTEGER,
    prodana_povrsina NUMERIC(10,2),
    prodani_delez_dela_stavbe VARCHAR(20),
    prodana_povrsina_dela_stavbe NUMERIC(10,2),
    prodana_uporabna_povrsina_dela_stavbe NUMERIC(10,2),
    nadstropje_dela_stavbe VARCHAR(50),
    stevilo_zunanjih_parkirnih_mest INTEGER,
    atrij INTEGER,
    povrsina_atrija NUMERIC(10,2),
    opombe_o_nepremicnini TEXT,
    dejanska_raba_dela_stavbe VARCHAR(100),
    lega_dela_stavbe_v_stavbi VARCHAR(50),
    stevilo_sob INTEGER,
    povrsina_dela_stavbe NUMERIC(10,2),
    uporabna_povrsina NUMERIC(10,2),
    prostori_dela_stavbe TEXT,
    pogodbena_cena_dela_stavbe NUMERIC(12,2),
    stopnja_ddv_dela_stavbe NUMERIC(5,2),
    e_centroid NUMERIC(10,2),
    n_centroid NUMERIC(10,2),
    leto INTEGER
);


DROP TABLE IF EXISTS staging.kpp_posel;
CREATE TABLE staging.kpp_posel (
    id_posla INTEGER,
    vrsta_kupoprodajnega_posla INTEGER,
    datum_uveljavitve TEXT,
    datum_sklenitve_pogodbe TEXT,
    pogodbena_cena_odskodnina NUMERIC(12,2),
    vkljucenost_ddv INTEGER,
    stopnja_ddv NUMERIC(5,2),
    datum_izteka_lizinga TEXT,
    datum_prenehanja_lizinga TEXT,
    opombe_o_pravnem_poslu TEXT,
    posredovanje_nepremicninske_agencije INTEGER,
    datum_zadnje_spremembe_posla TEXT,
    datum_zadnje_uveljavitve_posla TEXT,
    vrsta_akta INTEGER,
    trznost_posla INTEGER,
    leto INTEGER
);



DROP TABLE IF EXISTS staging.kpp_zemljisce;
CREATE TABLE staging.kpp_zemljisce (
    id_posla INTEGER,
    sifra_ko INTEGER,
    ime_ko VARCHAR(100),
    obcina VARCHAR(100),
    parcelna_stevilka VARCHAR(50),
    vrsta_zemljisca INTEGER,
    vrsta_trajnega_nasada VARCHAR(100),
    starost_trajnega_nasada INTEGER,
    prodani_delez_parcele VARCHAR(20),
    opombe_o_nepremicnini TEXT,
    povrsina_parcele NUMERIC(10,2),
    pogodbena_cena_parcele NUMERIC(12,2),
    stopnja_ddv_parcele NUMERIC(5,2),
    e_centroid NUMERIC(10,2),
    n_centroid NUMERIC(10,2),
    leto INTEGER
);