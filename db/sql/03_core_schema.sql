CREATE SCHEMA IF NOT EXISTS core;

-- 3.1 core.del_stavbe
DROP TABLE IF EXISTS core.del_stavbe;
CREATE TABLE core.del_stavbe (
  del_stavbe_id         SERIAL      PRIMARY KEY,
  posel_id              INTEGER     NOT NULL,
  sifra_ko              SMALLINT    NOT NULL,
  ime_ko                TEXT,
  obcina                TEXT,
  stevilka_stavbe       INTEGER,
  stevilka_dela_stavbe  INTEGER,
  naselje               TEXT,
  ulica                 TEXT,
  hisna_stevilka        TEXT,
  dodatek_hs            TEXT,
  stev_stanovanja       INTEGER,

  opremljenost          SMALLINT,

  dejanska_raba         TEXT,
  lega_dela_stavbe      TEXT,
  povrsina              NUMERIC,
  povrsina_uporabna     NUMERIC,
  gostinski_vrt         SMALLINT,
  vkljucen_gostinski_vrt_v_najemnino SMALLINT,

  -- podatki so pretvorjeni iz slovenskega sistema (SRID 3794) v WGS84
  coordinates              GEOMETRY(Point, 4326),
  leto                  INTEGER,


  vrsta_prostorov_code SMALLINT,
  vrsta_prostorov_desc TEXT
);

-- 3.2 core.posel
DROP TABLE IF EXISTS core.posel;
CREATE TABLE core.posel (
  posel_id                     INTEGER     PRIMARY KEY,
  vrsta_posla_code             SMALLINT,
  vrsta_posla_desc             TEXT,
  datum_uveljavitve            DATE,
  datum_sklenitve              DATE,
  najemnina                    NUMERIC,
  vkljuceno_stroski            BOOLEAN,
  vkljuceno_ddv                BOOLEAN,
  stopnja_ddv                  NUMERIC,
  datum_zacetka_najemanja      DATE,
  datum_prenehanja_najemanja   DATE,
  cas_najemanja                SMALLINT,
  trajanje_najemanja           INTEGER,
  opombe                       TEXT,
  posredovanje_agencije        SMALLINT,
  trznost_posla_code           SMALLINT,
  trznost_posla_desc           TEXT,
  vrsta_akta_code              SMALLINT,
  vrsta_akta_desc              TEXT,
  datum_zadnje_spremembe       DATE,
  datum_zadnje_uveljavitve     DATE,
  leto                         INTEGER
);

-- 3.3 Indeksi
DROP INDEX IF EXISTS del_stavbe_coordinates_idx;
DROP INDEX IF EXISTS del_stavbe_leto_idx;
DROP INDEX IF EXISTS del_stavbe_povrsina_idx;
DROP INDEX IF EXISTS posel_datum_zacetka_najemanja_idx;

CREATE INDEX del_stavbe_coordinates_idx ON core.del_stavbe USING GIST(coordinates);
CREATE INDEX del_stavbe_leto_idx ON core.del_stavbe (leto);
CREATE INDEX del_stavbe_povrsina_idx ON core.del_stavbe (povrsina);
CREATE INDEX posel_datum_zacetka_najemanja_idx ON core.posel (datum_zacetka_najemanja);