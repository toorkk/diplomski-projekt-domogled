-- Ustvari staging tabele
CREATE SCHEMA IF NOT EXISTS staging;

-- staging.sifranti
DROP TABLE IF EXISTS staging.sifranti;
CREATE TABLE staging.sifranti (
  id                 INTEGER,
  sifrant            TEXT,
  numericna_vrednost TEXT,
  opis               TEXT
);

-- staging.np_del_stavbe
DROP TABLE IF EXISTS staging.np_del_stavbe;
CREATE TABLE staging.np_del_stavbe (
  id_posla                                    INTEGER,
  sifra_ko                                    SMALLINT,
  ime_ko                                      VARCHAR(101),
  obcina                                      VARCHAR(102),
  stevilka_stavbe                             INTEGER,
  stevilka_dela_stavbe                        INTEGER,
  interna_oznaka_oddanih_prostorov            VARCHAR(300),
  naselje                                     VARCHAR(103),
  ulica                                       VARCHAR(300),
  hisna_stevilka                              VARCHAR(40),
  dodatek_hs                                  VARCHAR(10),
  stevilka_stanovanja_ali_poslovnega_prostora INTEGER,
  vrsta_oddanih_prostorov                     SMALLINT,
  opremljenost_oddanih_prostorov              SMALLINT,
  mikrolokacija_oddanih_prostorov             SMALLINT,
  izlozba                                     SMALLINT,
  nakupovalni_center                          SMALLINT,
  povrsina_oddanih_prostorov                  NUMERIC(10,2),
  povrsina_oddanih_prostorov_enaka_delu_stavbe NUMERIC,
  pogodbena_najemnina_posameznih_oddanih_prostorov NUMERIC,
  opombe_o_oddanih_prostorih                   TEXT,
  leto_izgradnje_stavbe                       INTEGER,
  dejanska_raba_dela_stavbe                   TEXT,
  lega_dela_stavbe_v_stavbi                   TEXT,
  stevilo_sob                                 INTEGER,
  povrsina_dela_stavbe                        NUMERIC(10,2),
  uporabna_povrsina_dela_stavbe               NUMERIC(10,2),
  prostori_dela_stavbe                        TEXT,
  uporabna_povrsina_oddanih_prostorov         NUMERIC(10,2),
  gostinski_vrt                               SMALLINT,
  vkljucenost_gostinskega_vrta_v_najemnino    SMALLINT,
  povrsina_gostinskega_vrta                   NUMERIC(10,2),
  e_centroid                                  NUMERIC,
  n_centroid                                  NUMERIC,
  leto                                        INTEGER
);

-- staging.np_posel
DROP TABLE IF EXISTS staging.np_posel;
CREATE TABLE staging.np_posel (
  id_posla                               INTEGER,
  vrsta_najemnega_posla                  SMALLINT,
  datum_uveljavitve                      TEXT,
  datum_sklenitve_pogodbe                TEXT,
  pogodbena_najemnina                    NUMERIC,
  vkljucenost_obratovalnih_stroskov_v_najemnino SMALLINT,
  vkljucenost_ddv                        SMALLINT,
  stopnja_ddv                            NUMERIC,
  datum_zacetka_najema                   TEXT,
  datum_prenehanja_najema                TEXT,
  cas_najema                             SMALLINT,
  trajanje_najema                        INTEGER,
  datum_zakljucka_najema_datum_predcasne_prekinitve_najema TEXT,
  opombe_o_pravnem_poslu                 TEXT,
  posredovanje_nepremicninske_agencije   SMALLINT,
  datum_zadnje_spremembe_posla           TEXT,
  datum_zadnje_uveljavitve_posla         TEXT,
  vrsta_akta                             SMALLINT,
  trznost_posla                          SMALLINT,
  leto                                   INTEGER
);