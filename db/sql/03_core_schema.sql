CREATE SCHEMA IF NOT EXISTS core;


DROP TABLE IF EXISTS core.np_del_stavbe;
CREATE TABLE core.np_del_stavbe (
  del_stavbe_id         SERIAL      PRIMARY KEY,
  posel_id              INTEGER     NOT NULL,
  sifra_ko              SMALLINT    NOT NULL,
  ime_ko                VARCHAR(100),
  obcina                VARCHAR(100),
  stevilka_stavbe       INTEGER,
  stevilka_dela_stavbe  INTEGER,

  naselje               VARCHAR(100),
  ulica                 VARCHAR(100),
  hisna_stevilka        VARCHAR(20),
  dodatek_hs            VARCHAR(10),
  stev_stanovanja       INTEGER,
  vrsta                 SMALLINT,
  opremljenost          SMALLINT,

  opombe                TEXT,
  leto_izgradnje_stavbe INTEGER,
  dejanska_raba         VARCHAR(100),
  lega_v_stavbi         VARCHAR(20),

  povrsina              NUMERIC(10,2),
  povrsina_uporabna     NUMERIC(10,2),
  prostori              TEXT,

  -- podatki so pretvorjeni iz slovenskega sistema (SRID 3794) v WGS84
  coordinates           GEOMETRY(Point, 4326),
  leto                  INTEGER
);


DROP TABLE IF EXISTS core.np_posel;
CREATE TABLE core.np_posel (
  posel_id                     INTEGER     PRIMARY KEY,
  vrsta_posla_code             SMALLINT,

  datum_uveljavitve            DATE,
  datum_sklenitve              DATE,
  najemnina                    NUMERIC(10,2),
  vkljuceno_stroski            BOOLEAN,
  vkljuceno_ddv                BOOLEAN,
  stopnja_ddv                  NUMERIC,
  datum_zacetka_najemanja      DATE,
  datum_prenehanja_najemanja   DATE,
  cas_najemanja                SMALLINT,
  trajanje_najemanja           SMALLINT,
  datum_zakljucka_najema       DATE,
  opombe                       TEXT,
  posredovanje_agencije        BOOLEAN,
  datum_zadnje_spremembe       DATE,
  datum_zadnje_uveljavitve     DATE,
  vrsta_akta                   SMALLINT,
  trznost_posla                SMALLINT,

  leto                         INTEGER
);


DROP INDEX IF EXISTS np_del_stavbe_coordinates_idx;
DROP INDEX IF EXISTS np_del_stavbe_ko_stavba_idx;
DROP INDEX IF EXISTS np_del_stavbe_posel_id_idx;

CREATE INDEX np_del_stavbe_coordinates_idx ON core.np_del_stavbe USING GIST(coordinates);
CREATE INDEX np_del_stavbe_ko_stavba_idx ON core.np_del_stavbe(sifra_ko, stevilka_stavbe);
CREATE INDEX np_del_stavbe_posel_id_idx ON core.np_del_stavbe(posel_id);



DROP TABLE IF EXISTS core.kpp_del_stavbe;
CREATE TABLE core.kpp_del_stavbe (
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
    stev_stanovanja INTEGER,
    vrsta SMALLINT,
    leto_izgradnje_dela_stavbe INTEGER,
    stavba_je_dokoncana INTEGER, --- not sure ce to obdrzimo
    gradbena_faza INTEGER,  --- not sure ce to obdrzimo
    novogradnja INTEGER,
    prodana_povrsina NUMERIC(10,2),
    prodani_delez VARCHAR(20),
    prodana_povrsina_dela_stavbe NUMERIC(10,2),
    prodana_uporabna_povrsina_dela_stavbe NUMERIC(10,2),
    nadstropje VARCHAR(50),
    stevilo_zunanjih_parkirnih_mest INTEGER,
    atrij INTEGER,
    povrsina_atrija NUMERIC(10,2),
    opombe_o_nepremicnini TEXT,
    dejanska_raba VARCHAR(100),
    lega_v_stavbi VARCHAR(20),
    stevilo_sob INTEGER,
    povrsina NUMERIC(10,2),
    povrsina_uporabna NUMERIC(10,2),
    prostori TEXT,
    pogodbena_cena NUMERIC(12,2),
    stopnja_ddv NUMERIC(5,2),

  -- podatki so pretvorjeni iz slovenskega sistema (SRID 3794) v WGS84
    coordinates              GEOMETRY(Point, 4326),
    leto                  INTEGER,
);



DROP TABLE IF EXISTS core.kpp_posel;
CREATE TABLE core.kpp_posel (
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


DROP INDEX IF EXISTS kpp_del_stavbe_coordinates_idx;
DROP INDEX IF EXISTS kpp_del_stavbe_ko_stavba_idx;
DROP INDEX IF EXISTS kpp_del_stavbe_posel_id_idx;

CREATE INDEX kpp_del_stavbe_coordinates_idx ON core.kpp_del_stavbe USING GIST(coordinates);
CREATE INDEX kpp_del_stavbe_ko_stavba_idx ON core.kpp_del_stavbe(sifra_ko, stevilka_stavbe);
CREATE INDEX kpp_del_stavbe_posel_id_idx ON core.kpp_del_stavbe(posel_id);