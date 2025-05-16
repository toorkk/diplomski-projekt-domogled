-- 4.1 napolni core.properties
INSERT INTO core.del_stavbe (
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

  opremljenost,

  dejanska_raba,
  lega_dela_stavbe,
  povrsina, 
  povrsina_uporabna, 
  gostinski_vrt,
  vkljucen_gostinski_vrt_v_najemnino,

  coordinates, 
  leto,

  vrsta_prostorov_code, 
  vrsta_prostorov_desc
)
SELECT
  d.ID_POSLA,
  d.SIFRA_KO,
  d.IME_KO,
  d.OBCINA,
  d.STEVILKA_STAVBE,
  d.STEVILKA_DELA_STAVBE,
  d.NASELJE,
  d.ULICA,
  d.HISNA_STEVILKA,
  d.DODATEK_HS,
  d.STEVILKA_STANOVANJA_ALI_POSLOVNEGA_PROSTORA,

  d.OPREMLJENOST_ODDANIH_PROSTOROV,

  d.DEJANSKA_RABA_DELA_STAVBE,
  d.LEGA_DELA_STAVBE_V_STAVBI,
  d.POVRSINA_DELA_STAVBE,
  d.UPORABNA_POVRSINA_DELA_STAVBE,
  d.GOSTINSKI_VRT,
  d.VKLJUCENOST_GOSTINSKEGA_VRTA_V_NAJEMNINO,

  -- podatki so pretvorjeni iz slovenskega sistema (SRID 3794) v WGS84
  ST_Transform(ST_SetSRID(ST_MakePoint(d.E_CENTROID, d.N_CENTROID), 3794), 4326),
  d.LETO,

  d.VRSTA_ODDANIH_PROSTOROV,
  s1.opis
FROM staging.del_stavbe d
LEFT JOIN staging.sifranti s1 ON s1.sifrant='Vrsta oddanih prostorov' AND s1.numericna_vrednost=d.VRSTA_ODDANIH_PROSTOROV::TEXT;

-- 4.2 napolni core.posel
INSERT INTO core.posel (
  posel_id,
  vrsta_posla_code,
  vrsta_posla_desc,
  datum_uveljavitve,
  datum_sklenitve,
  najemnina,
  vkljuceno_stroski,
  vkljuceno_ddv,
  stopnja_ddv,
  datum_zacetka_najemanja,
  datum_prenehanja_najemanja,
  cas_najemanja,
  trajanje_najemanja,
  opombe,
  posredovanje_agencije,
  trznost_posla_code,
  trznost_posla_desc,
  vrsta_akta_code,
  vrsta_akta_desc,
  datum_zadnje_spremembe,
  datum_zadnje_uveljavitve,
  leto
)
SELECT
  p.ID_POSLA,
  p.VRSTA_NAJEMNEGA_POSLA,
  s1.opis,
  TO_DATE(p.DATUM_UVELJAVITVE, 'DD.MM.YYYY'),
  TO_DATE(p.DATUM_SKLENITVE_POGODBE, 'DD.MM.YYYY'),
  p.POGODBENA_NAJEMNINA,
  CASE WHEN p.VKLJUCENOST_OBRATOVALNIH_STROSKOV_V_NAJEMNINO = 1 THEN TRUE ELSE FALSE END,
  CASE WHEN p.VKLJUCENOST_DDV = 1 THEN TRUE ELSE FALSE END,
  p.STOPNJA_DDV,
  TO_DATE(p.DATUM_ZACETKA_NAJEMA, 'DD.MM.YYYY'),
  TO_DATE(NULLIF(p.DATUM_PRENEHANJA_NAJEMA, ''), 'DD.MM.YYYY'),
  p.CAS_NAJEMA,
  p.TRAJANJE_NAJEMA,
  p.OPOMBE_O_PRAVNEM_POSLU,
  p.POSREDOVANJE_NEPREMICNINSKE_AGENCIJE,
  p.TRZNOST_POSLA,
  s3.opis,
  p.VRSTA_AKTA,
  s4.opis,
  TO_DATE(p.DATUM_ZADNJE_SPREMEMBE_POSLA, 'DD.MM.YYYY'),
  TO_DATE(p.DATUM_ZADNJE_UVELJAVITVE_POSLA, 'DD.MM.YYYY'),
  p.LETO
FROM staging.posel p
LEFT JOIN staging.sifranti s1 ON s1.sifrant='Vrsta najemnega posla' AND s1.numericna_vrednost=p.VRSTA_NAJEMNEGA_POSLA::TEXT
LEFT JOIN staging.sifranti s3 ON s3.sifrant='Tržnost posla' AND s3.numericna_vrednost=p.TRZNOST_POSLA::TEXT
LEFT JOIN staging.sifranti s4 ON s4.sifrant='Vrsta akta' AND s4.numericna_vrednost=p.VRSTA_AKTA::TEXT;