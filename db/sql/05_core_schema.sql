CREATE SCHEMA IF NOT EXISTS core;


DROP TABLE IF EXISTS core.np_del_stavbe;
CREATE TABLE core.np_del_stavbe (
  del_stavbe_id         SERIAL          PRIMARY KEY,
  posel_id              INTEGER         NOT NULL,
  sifra_ko              SMALLINT        NOT NULL,
  ime_ko                VARCHAR(101),
  obcina                VARCHAR(102),
  stevilka_stavbe       INTEGER,
  stevilka_dela_stavbe  INTEGER,

  naselje               VARCHAR(103),
  ulica                 VARCHAR(300),
  hisna_stevilka        VARCHAR(40),
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


DROP TABLE IF EXISTS core.kpp_del_stavbe;
CREATE TABLE core.kpp_del_stavbe (
    del_stavbe_id                           SERIAL          PRIMARY KEY,
    posel_id                                INTEGER         NOT NULL,
    sifra_ko                                SMALLINT        NOT NULL,
    ime_ko                                  VARCHAR(101),
    obcina                                  VARCHAR(102),
    stevilka_stavbe                         INTEGER,
    stevilka_dela_stavbe                    INTEGER,

    naselje                                 VARCHAR(103),
    ulica                                   VARCHAR(300),
    hisna_stevilka                          VARCHAR(40),
    dodatek_hs                              VARCHAR(10),
    stev_stanovanja                         INTEGER,
    vrsta                                   SMALLINT,
    leto_izgradnje_stavbe                   INTEGER,
    stavba_je_dokoncana                     INTEGER,        --- not sure ce to obdrzimo
    gradbena_faza                           INTEGER,        --- not sure ce to obdrzimo
    novogradnja                             INTEGER,
    prodana_povrsina                        NUMERIC(10,2),
    prodani_delez                           VARCHAR(199),
    prodana_povrsina_dela_stavbe            NUMERIC(10,2),
    prodana_uporabna_povrsina_dela_stavbe   NUMERIC(10,2),
    nadstropje                              VARCHAR(50),
    stevilo_zunanjih_parkirnih_mest         INTEGER,
    atrij                                   INTEGER,
    povrsina_atrija                         NUMERIC(10,2),
    opombe                                  TEXT,
    dejanska_raba                           VARCHAR(310),
    lega_v_stavbi                           VARCHAR(50),
    stevilo_sob                             INTEGER,
    povrsina                                NUMERIC(10,2),
    povrsina_uporabna                       NUMERIC(10,2),
    prostori                                TEXT,
    pogodbena_cena                          NUMERIC(20,2),
    stopnja_ddv                             NUMERIC(5,2),

  -- podatki so pretvorjeni iz slovenskega sistema (SRID 3794) v WGS84
    coordinates                             GEOMETRY(Point, 4326),
    leto                                    INTEGER
);




DROP TABLE IF EXISTS core.np_posel;
CREATE TABLE core.np_posel (
  posel_id                     INTEGER         PRIMARY KEY,
  vrsta_posla                  SMALLINT,

  datum_uveljavitve            DATE,
  datum_sklenitve              DATE,
  najemnina                    NUMERIC(20,2),
  vkljuceno_stroski            BOOLEAN,
  vkljuceno_ddv                BOOLEAN,
  stopnja_ddv                  NUMERIC(5,2),

  datum_zacetka_najemanja      DATE,
  datum_prenehanja_najemanja   DATE,
  cas_najemanja                INTEGER,
  trajanje_najemanja           INTEGER,
  datum_zakljucka_najema       DATE,

  opombe                       TEXT,
  posredovanje_agencije        BOOLEAN,
  datum_zadnje_spremembe       DATE,
  datum_zadnje_uveljavitve     DATE,
  vrsta_akta                   SMALLINT,
  trznost_posla                SMALLINT,

  leto                         INTEGER
);


DROP TABLE IF EXISTS core.kpp_posel;
CREATE TABLE core.kpp_posel (
    posel_id                INTEGER         PRIMARY KEY,
    vrsta_posla             SMALLINT,

    datum_uveljavitve       DATE,
    datum_sklenitve         DATE,
    cena                    NUMERIC(12,2),
    vkljuceno_ddv           BOOLEAN,
    stopnja_ddv             NUMERIC(5,2),
    
    -- ta dva povzrocata tezave pri importu v to tabelo is staging
    --datum_izteka_lizinga DATE,
    --datum_prenehanja_lizinga DATE,
    
    opombe                  TEXT,
    posredovanje_agencije   BOOLEAN,
    datum_zadnje_spremembe  DATE,
    datum_zadnje_uveljavitve DATE,
    trznost_posla           SMALLINT,
    vrsta_akta              SMALLINT,
    leto                    INTEGER
);




DROP TABLE IF EXISTS core.np_del_stavbe_deduplicated;
CREATE TABLE core.np_del_stavbe_deduplicated (
    del_stavbe_id               SERIAL          PRIMARY KEY,
    
    -- ID / composite ključ
    sifra_ko                    SMALLINT        NOT NULL,
    stevilka_stavbe             INTEGER         NOT NULL,
    stevilka_dela_stavbe        INTEGER         NOT NULL,
    dejanska_raba               VARCHAR(310)    NOT NULL,

    obcina                      VARCHAR(102),
    naselje                     VARCHAR(103),
    ulica                       VARCHAR(300),
    hisna_stevilka              VARCHAR(40),
    dodatek_hs                  VARCHAR(10),
    stev_stanovanja             INTEGER,

    povrsina                    NUMERIC(10,2),
    povrsina_uporabna           NUMERIC(10,2),
    leto_izgradnje_stavbe       INTEGER,
    opremljenost                SMALLINT,

    zadnja_najemnina            NUMERIC(20,2),
    zadnje_vkljuceno_stroski    BOOLEAN,
    zadnje_vkljuceno_ddv        BOOLEAN,
    zadnja_stopnja_ddv          NUMERIC(5,2),
    zadnje_leto                 INTEGER,

    povezani_del_stavbe_ids     INTEGER[]       NOT NULL,
    povezani_posel_ids          INTEGER[]       NOT NULL,
    najnovejsi_del_stavbe_id    INTEGER         NOT NULL,
    energetske_izkaznice        INTEGER[],
    energijski_razred           VARCHAR(3),
    
    coordinates                 GEOMETRY(Point, 4326) NOT NULL,
    
    CONSTRAINT uq_np_deduplicated UNIQUE(sifra_ko, stevilka_stavbe, stevilka_dela_stavbe, dejanska_raba)
);


DROP TABLE IF EXISTS core.kpp_del_stavbe_deduplicated;
CREATE TABLE core.kpp_del_stavbe_deduplicated (
    del_stavbe_id               SERIAL          PRIMARY KEY,
    
    -- ID / composite ključ
    sifra_ko                    SMALLINT        NOT NULL,
    stevilka_stavbe             INTEGER         NOT NULL,
    stevilka_dela_stavbe        INTEGER         NOT NULL,
    dejanska_raba               VARCHAR(310)    NOT NULL,

    obcina                      VARCHAR(102),
    naselje                     VARCHAR(103),
    ulica                       VARCHAR(300),
    hisna_stevilka              VARCHAR(40),
    dodatek_hs                  VARCHAR(10),
    stev_stanovanja             INTEGER,
    
    povrsina                    NUMERIC(10,2),
    povrsina_uporabna           NUMERIC(10,2),
    leto_izgradnje_stavbe       INTEGER,
    stevilo_sob                 INTEGER,

    zadnja_cena                 NUMERIC(20,2),
    zadnje_vkljuceno_ddv        BOOLEAN,
    zadnja_stopnja_ddv          NUMERIC(5,2),
    zadnje_leto                 INTEGER,

    povezani_del_stavbe_ids     INTEGER[]       NOT NULL,
    povezani_posel_ids          INTEGER[]       NOT NULL,
    najnovejsi_del_stavbe_id    INTEGER         NOT NULL,
    energetske_izkaznice        INTEGER[],
    energijski_razred           VARCHAR(3),

    coordinates                 GEOMETRY(Point, 4326) NOT NULL,
    
    CONSTRAINT uq_kpp_deduplicated UNIQUE(sifra_ko, stevilka_stavbe, stevilka_dela_stavbe, dejanska_raba)
);



DROP TABLE IF EXISTS core.energetska_izkaznica;
CREATE TABLE core.energetska_izkaznica (
    id SERIAL PRIMARY KEY,
    ei_id VARCHAR(25) NOT NULL,  -- drzavni id energetske izkaznice
    datum_izdelave DATE,
    velja_do DATE,
    sifra_ko SMALLINT,
    stevilka_stavbe INTEGER,
    stevilka_dela_stavbe INTEGER,
    tip_izkaznice VARCHAR(10),
    potrebna_toplota_ogrevanje NUMERIC(10,2),
    dovedena_energija_delovanje NUMERIC(10,2),
    celotna_energija NUMERIC(15,2),
    dovedena_elektricna_energija NUMERIC(15,2),
    primarna_energija NUMERIC(15,2),
    emisije_co2 NUMERIC(10,2),
    kondicionirana_povrsina NUMERIC(10,2),
    energijski_razred VARCHAR(3),
    epbd_tip VARCHAR(15),
    
    CONSTRAINT uq_ei_id UNIQUE(ei_id)
);



DROP INDEX IF EXISTS core.idx_np_del_stavbe_coordinates;
DROP INDEX IF EXISTS core.idx_np_del_stavbe_ko_stavba;
DROP INDEX IF EXISTS core.idx_np_del_stavbe_posel_id;

CREATE INDEX idx_np_del_stavbe_coordinates  ON core.np_del_stavbe USING GIST(coordinates);
CREATE INDEX idx_np_del_stavbe_ko_stavba    ON core.np_del_stavbe(sifra_ko, stevilka_stavbe);
CREATE INDEX idx_np_del_stavbe_posel_id     ON core.np_del_stavbe(posel_id);


DROP INDEX IF EXISTS core.idx_kpp_del_stavbe_coordinates;
DROP INDEX IF EXISTS core.idx_kpp_del_stavbe_ko_stavba;
DROP INDEX IF EXISTS core.idx_kpp_del_stavbe_posel_id;

CREATE INDEX idx_kpp_del_stavbe_coordinates ON core.kpp_del_stavbe USING GIST(coordinates);
CREATE INDEX idx_kpp_del_stavbe_ko_stavba   ON core.kpp_del_stavbe(sifra_ko, stevilka_stavbe);
CREATE INDEX idx_kpp_del_stavbe_posel_id    ON core.kpp_del_stavbe(posel_id);


DROP INDEX IF EXISTS core.idx_np_del_stavbe_deduplicated_building;
DROP INDEX IF EXISTS core.idx_np_del_stavbe_deduplicated_coords;
DROP INDEX IF EXISTS core.idx_np_del_stavbe_deduplicated_related_ids;

CREATE INDEX idx_np_del_stavbe_deduplicated_building        ON core.np_del_stavbe_deduplicated (sifra_ko, stevilka_stavbe);
CREATE INDEX idx_np_del_stavbe_deduplicated_coords          ON core.np_del_stavbe_deduplicated USING GIST (coordinates);
CREATE INDEX idx_np_del_stavbe_deduplicated_related_ids     ON core.np_del_stavbe_deduplicated USING GIN (povezani_del_stavbe_ids);


DROP INDEX IF EXISTS core.idx_kpp_del_stavbe_deduplicated_building;
DROP INDEX IF EXISTS core.idx_kpp_del_stavbe_deduplicated_coords;
DROP INDEX IF EXISTS core.idx_kpp_del_stavbe_deduplicated_related_ids;

CREATE INDEX idx_kpp_del_stavbe_deduplicated_building       ON core.kpp_del_stavbe_deduplicated (sifra_ko, stevilka_stavbe);
CREATE INDEX idx_kpp_del_stavbe_deduplicated_coords         ON core.kpp_del_stavbe_deduplicated USING GIST (coordinates);
CREATE INDEX idx_kpp_del_stavbe_deduplicated_related_ids    ON core.kpp_del_stavbe_deduplicated USING GIN (povezani_del_stavbe_ids);


DROP INDEX IF EXISTS core.idx_energetska_izkaznica_ko_stavba;

CREATE INDEX idx_energetska_izkaznica_ko_stavba ON core.energetska_izkaznica(sifra_ko, stevilka_stavbe, stevilka_dela_stavbe);
