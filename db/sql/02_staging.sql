-- 2.1 staging.sifranti
CREATE SCHEMA IF NOT EXISTS staging;

DROP TABLE IF EXISTS staging.sifranti;
CREATE TABLE staging.sifranti (
  id                 INTEGER,
  sifrant            TEXT,
  numericna_vrednost TEXT,
  opis               TEXT
);

-- 2.2 staging.del_stavbe
DROP TABLE IF EXISTS staging.del_stavbe;
CREATE TABLE staging.del_stavbe (
  ID_POSLA                                    INTEGER,
  SIFRA_KO                                    INTEGER,
  IME_KO                                      TEXT,
  OBCINA                                      TEXT,
  STEVILKA_STAVBE                             INTEGER,
  STEVILKA_DELA_STAVBE                        INTEGER,
  INTERNA_OZNAKA_ODDANIH_PROSTOROV            TEXT,
  NASELJE                                     TEXT,
  ULICA                                       TEXT,
  HISNA_STEVILKA                              TEXT,
  DODATEK_HS                                  TEXT,
  STEVILKA_STANOVANJA_ALI_POSLOVNEGA_PROSTORA INTEGER,
  VRSTA_ODDANIH_PROSTOROV                     SMALLINT,
  OPREMLJENOST_ODDANIH_PROSTOROV              SMALLINT,
  MIKROLOKACIJA_ODDANIH_PROSTOROV             SMALLINT,
  IZLOZBA                                     SMALLINT,
  NAKUPOVALNI_CENTER                          SMALLINT,
  POVRSINA_ODDANIH_PROSTOROV                  NUMERIC,
  POVRSINA_ODDANIH_PROSTOROV_ENAKA_DELU_STAVBE BOOLEAN,
  POGODBENA_NAJEMNINA_POSAMEZNIH_ODDANIH_PROSTOROV NUMERIC,
  OPOMBE_O_ODDANIH_PROSTORIH                   TEXT,
  LETO_IZGRADNJE_STAVBE                       INTEGER,
  DEJANSKA_RABA_DELA_STAVBE                   TEXT,
  LEGA_DELA_STAVBE_V_STAVBI                   TEXT,
  STEVILO_SOB                                 INTEGER,
  POVRSINA_DELA_STAVBE                        NUMERIC,
  UPORABNA_POVRSINA_DELA_STAVBE               NUMERIC,
  PROSTORI_DELA_STAVBE                        TEXT,
  UPORABNA_POVRSINA_ODDANIH_PROSTOROV         NUMERIC,
  GOSTINSKI_VRT                               SMALLINT,
  VKLJUCENOST_GOSTINSKEGA_VRTA_V_NAJEMNINO    SMALLINT,
  POVRSINA_GOSTINSKEGA_VRTA                   NUMERIC,
  E_CENTROID                                  NUMERIC,
  N_CENTROID                                  NUMERIC,
  LETO                                        INTEGER
);

-- 2.3 staging.posel
DROP TABLE IF EXISTS staging.posel;
CREATE TABLE staging.posel (
  ID_POSLA                               INTEGER,
  VRSTA_NAJEMNEGA_POSLA                  SMALLINT,
  DATUM_UVELJAVITVE                      TEXT,
  DATUM_SKLENITVE_POGODBE                TEXT,
  POGODBENA_NAJEMNINA                    NUMERIC,
  VKLJUCENOST_OBRATOVALNIH_STROSKOV_V_NAJEMNINO SMALLINT,
  VKLJUCENOST_DDV                        SMALLINT,
  STOPNJA_DDV                            NUMERIC,
  DATUM_ZACETKA_NAJEMA                   TEXT,
  DATUM_PRENEHANJA_NAJEMA                TEXT,
  CAS_NAJEMA                             SMALLINT,
  TRAJANJE_NAJEMA                        INTEGER,
  DATUM_ZAKLJUCKA_NAJEMA_DATUM_PREDCASNE_PREKINITVE_NAJEMA TEXT,
  OPOMBE_O_PRAVNEM_POSLU                 TEXT,
  POSREDOVANJE_NEPREMICNINSKE_AGENCIJE   SMALLINT,
  DATUM_ZADNJE_SPREMEMBE_POSLA           TEXT,
  DATUM_ZADNJE_UVELJAVITVE_POSLA         TEXT,
  VRSTA_AKTA                             SMALLINT,
  TRZNOST_POSLA                          SMALLINT,
  LETO                                   INTEGER
);

-- 2.4 Naloži staging podatke
\copy staging.sifranti(id, sifrant, numericna_vrednost, opis) FROM '/var/lib/postgresql/csv_data/ETN_SLO_2025_NP_sifranti_20250511.csv' WITH (FORMAT csv, HEADER true);
\copy staging.del_stavbe FROM '/var/lib/postgresql/csv_data/ETN_SLO_2025_NP_NP_DELISTAVB_20250511.csv' WITH (FORMAT csv, HEADER true);
\copy staging.posel FROM '/var/lib/postgresql/csv_data/ETN_SLO_2025_NP_NP_POSLI_20250511.csv' WITH (FORMAT csv, HEADER true);