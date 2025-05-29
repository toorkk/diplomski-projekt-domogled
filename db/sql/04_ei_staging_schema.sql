CREATE SCHEMA IF NOT EXISTS staging;

DROP TABLE IF EXISTS staging.energetska_izkaznica;
CREATE TABLE staging.energetska_izkaznica (
    ei_id VARCHAR(25) NOT NULL,
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
    epbd_tip VARCHAR(15)
);