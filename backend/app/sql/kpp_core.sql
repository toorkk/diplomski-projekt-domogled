CREATE TABLE kpp_del_stavbe (
    del_stavbe_id         SERIAL      PRIMARY KEY,
    posel_id              INTEGER     NOT NULL,
    sifra_ko              SMALLINT    NOT NULL,
    ime_ko VARCHAR(100),
    obcina VARCHAR(100),
    stevilka_stavbe INTEGER,
    stevilka_dela_stavbe INTEGER,

    naselje VARCHAR(100),
    ulica VARCHAR(100),
    hisna_stevilka VARCHAR(20),
    dodatek_hs VARCHAR(10),
    stev_stanovanja VARCHAR(20),
    vrsta_dela_stavbe INTEGER,
    leto_izgradnje_dela_stavbe INTEGER,
    stavba_je_dokoncana INTEGER, --- not sure ce to obdrzimo
    gradbena_faza INTEGER,  --- not sure ce to obdrzimo
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

    coordinates              GEOMETRY(Point, 4326),
    leto                  INTEGER,
);



CREATE TABLE kpp_posel (
    posel_id                     INTEGER     PRIMARY KEY,
    vrsta_posla_code             SMALLINT,
    vrsta_posla_desc             TEXT,
    datum_uveljavitve DATE,
    datum_sklenitve DATE,
    cena NUMERIC(12,2),
    vkljuceno_ddv BOOLEAN,
    stopnja_ddv NUMERIC(5,2),
    datum_izteka_lizinga DATE,
    datum_prenehanja_lizinga DATE,
    opombe TEXT,
    posredovanje_agencije BOOLEAN,
    trznost_posla_code           SMALLINT,
    trznost_posla_desc           TEXT,
    vrsta_akta_code              SMALLINT,
    vrsta_akta_desc              TEXT,
    datum_zadnje_spremembe DATE,
    datum_zadnje_uveljavitve DATE,
    leto INTEGER
);