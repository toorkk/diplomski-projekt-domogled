from sqlalchemy import Column, Integer, Text, Date, Numeric, Boolean, SmallInteger, String, ARRAY, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from geoalchemy2 import Geometry

Base = declarative_base()


class NpDelStavbe(Base):
    __tablename__ = "np_del_stavbe"
    __table_args__ = {"schema": "core"}
    
    del_stavbe_id = Column(Integer, primary_key=True)
    posel_id = Column(Integer, nullable=False)
    sifra_ko = Column(SmallInteger, nullable=False)
    ime_ko = Column(String(101))
    obcina = Column(String(102))
    stevilka_stavbe = Column(Integer)
    stevilka_dela_stavbe = Column(Integer)

    naselje = Column(String(103))
    ulica = Column(String(300))
    hisna_stevilka = Column(Integer)
    dodatek_hs = Column(String(10))
    stev_stanovanja = Column(Integer)
    vrsta_nepremicnine = Column(SmallInteger)
    opremljenost = Column(SmallInteger)

    opombe = Column(Text)
    leto_izgradnje_stavbe = Column(Integer)
    dejanska_raba = Column(String(100))
    tip_rabe = Column(String(50))
    lega_v_stavbi = Column(String(20))

    povrsina_uradna = Column(Numeric(10, 2))
    povrsina_uporabna = Column(Numeric(10, 2))
    prostori = Column(Text)
    
    coordinates = Column(Geometry('Point', 4326))
    leto = Column(Integer)


class NpDelStavbeDeduplicated(Base):
    __tablename__ = "np_del_stavbe_deduplicated"
    __table_args__ = (
        UniqueConstraint('sifra_ko', 'stevilka_stavbe', 'stevilka_dela_stavbe', 'dejanska_raba', name='uq_np_deduplicated'),
        {'schema': 'core'}
    )

    del_stavbe_id = Column(Integer, primary_key=True, autoincrement=True)
    
    # ID / composite ključ
    sifra_ko = Column(SmallInteger, nullable=False)
    stevilka_stavbe = Column(Integer, nullable=False)
    stevilka_dela_stavbe = Column(Integer, nullable=False)
    dejanska_raba = Column(String(310), nullable=False)
    tip_rabe = Column(String(50))
    
    obcina = Column(String(102))
    naselje = Column(String(103))
    ulica = Column(String(300))
    hisna_stevilka = Column(Integer)
    dodatek_hs = Column(String(10))
    stev_stanovanja = Column(Integer)
    
    povrsina_uradna = Column(Numeric(10, 2))
    povrsina_uporabna = Column(Numeric(10, 2))
    leto_izgradnje_stavbe = Column(Integer)
    opremljenost = Column(SmallInteger)
    
    zadnja_najemnina = Column(Numeric(20, 2))
    zadnje_vkljuceno_stroski = Column(Boolean)
    zadnje_vkljuceno_ddv = Column(Boolean)
    zadnja_stopnja_ddv = Column(Numeric(5, 2))
    zadnje_leto = Column(Integer)
    
    povezani_del_stavbe_ids = Column(ARRAY(Integer), nullable=False)
    povezani_posel_ids = Column(ARRAY(Integer), nullable=False)
    najnovejsi_del_stavbe_id = Column(Integer, nullable=False)
    
    energetske_izkaznice = Column(ARRAY(Integer))
    energijski_razred = Column(String(3))

    coordinates = Column(Geometry('Point', 4326), nullable=False)


class NpPosel(Base):
    __tablename__ = "np_posel"
    __table_args__ = {"schema": "core"}
    
    posel_id = Column(Integer, primary_key=True)
    vrsta_posla = Column(SmallInteger)
    
    datum_uveljavitve = Column(Date)
    datum_sklenitve = Column(Date)
    najemnina = Column(Numeric(20, 2))
    vkljuceno_stroski = Column(Boolean)
    vkljuceno_ddv = Column(Boolean)
    stopnja_ddv = Column(Numeric(5, 2))
    
    datum_zacetka_najemanja = Column(Date)
    datum_prenehanja_najemanja = Column(Date)
    cas_najemanja = Column(Integer)
    trajanje_najemanja = Column(Integer)
    datum_zakljucka_najema = Column(Date)
    
    opombe = Column(Text)
    datum_zadnje_spremembe = Column(Date)
    datum_zadnje_uveljavitve = Column(Date)
    vrsta_akta = Column(SmallInteger)
    trznost_posla = Column(SmallInteger)
    
    leto = Column(Integer)


class KppDelStavbe(Base):
    __tablename__ = "kpp_del_stavbe"
    __table_args__ = {"schema": "core"}
    
    del_stavbe_id = Column(Integer, primary_key=True, autoincrement=True)
    posel_id = Column(Integer, nullable=False)
    sifra_ko = Column(SmallInteger, nullable=False)
    ime_ko = Column(String(101))
    obcina = Column(String(102))
    stevilka_stavbe = Column(Integer)
    stevilka_dela_stavbe = Column(Integer)
    
    naselje = Column(String(103))
    ulica = Column(String(300))
    hisna_stevilka = Column(Integer)
    dodatek_hs = Column(String(10))
    stev_stanovanja = Column(Integer)
    vrsta_nepremicnine = Column(SmallInteger)
    leto_izgradnje_stavbe = Column(Integer)
    stavba_je_dokoncana = Column(Integer)
    gradbena_faza = Column(Integer)
    novogradnja = Column(Integer)
    prodani_delez = Column(String(199))
    nadstropje = Column(Integer)
    opombe = Column(Text)
    dejanska_raba = Column(String(310))
    tip_rabe = Column(String(50))
    lega_v_stavbi = Column(String(50))
    stevilo_sob = Column(Integer)
    
    povrsina_uradna = Column(Numeric(10, 2))
    povrsina_uporabna = Column(Numeric(10, 2))
    
    prostori = Column(Text)
    pogodbena_cena = Column(Numeric(20, 2))
    stopnja_ddv = Column(Numeric(5, 2))
    
    coordinates = Column(Geometry('Point', 4326))
    leto = Column(Integer)


class KppDelStavbeDeduplicated(Base):
    __tablename__ = "kpp_del_stavbe_deduplicated"
    __table_args__ = (
        UniqueConstraint('sifra_ko', 'stevilka_stavbe', 'stevilka_dela_stavbe', 'dejanska_raba', name='uq_kpp_deduplicated'),
        {'schema': 'core'}
    )

    del_stavbe_id = Column(Integer, primary_key=True, autoincrement=True)
    
    # ID / composite ključ
    sifra_ko = Column(SmallInteger, nullable=False)
    stevilka_stavbe = Column(Integer, nullable=False)
    stevilka_dela_stavbe = Column(Integer, nullable=False)
    dejanska_raba = Column(String(310), nullable=False)
    tip_rabe = Column(String(50))
    
    obcina = Column(String(102))
    naselje = Column(String(103))
    ulica = Column(String(300))
    hisna_stevilka = Column(Integer)
    dodatek_hs = Column(String(10))
    stev_stanovanja = Column(Integer)
    
    povrsina_uradna = Column(Numeric(10, 2)) 
    povrsina_uporabna = Column(Numeric(10, 2))
    leto_izgradnje_stavbe = Column(Integer)
    stevilo_sob = Column(Integer)
    
    zadnja_cena = Column(Numeric(20, 2))
    zadnje_vkljuceno_ddv = Column(Boolean)
    zadnja_stopnja_ddv = Column(Numeric(5, 2))
    zadnje_leto = Column(Integer)
    
    povezani_del_stavbe_ids = Column(ARRAY(Integer), nullable=False)
    povezani_posel_ids = Column(ARRAY(Integer), nullable=False)
    najnovejsi_del_stavbe_id = Column(Integer, nullable=False)

    energetske_izkaznice = Column(ARRAY(Integer))
    energijski_razred = Column(String(3))
    
    coordinates = Column(Geometry('Point', 4326), nullable=False)


class KppPosel(Base):
    __tablename__ = "kpp_posel"
    __table_args__ = {"schema": "core"}
    
    posel_id = Column(Integer, primary_key=True)
    vrsta_posla = Column(SmallInteger)
    
    datum_uveljavitve = Column(Date)
    datum_sklenitve = Column(Date)
    cena = Column(Numeric(12, 2))
    vkljuceno_ddv = Column(Boolean)
    stopnja_ddv = Column(Numeric(5, 2))
    
    opombe = Column(Text)
    datum_zadnje_spremembe = Column(Date)
    datum_zadnje_uveljavitve = Column(Date)
    trznost_posla = Column(SmallInteger)
    leto = Column(Integer)


class EnergetskaIzkaznica(Base):
    __tablename__ = "energetska_izkaznica"
    __table_args__ = {"schema": "core"}
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    ei_id = Column(String(25), nullable=False, unique=True)
    datum_izdelave = Column(Date)
    velja_do = Column(Date)
    sifra_ko = Column(SmallInteger)
    stevilka_stavbe = Column(Integer)
    stevilka_dela_stavbe = Column(Integer)
    tip_izkaznice = Column(String(10))
    potrebna_toplota_ogrevanje = Column(Numeric(10, 2))
    dovedena_energija_delovanje = Column(Numeric(10, 2))
    celotna_energija = Column(Numeric(15, 2))
    dovedena_elektricna_energija = Column(Numeric(15, 2))
    primarna_energija = Column(Numeric(15, 2))
    emisije_co2 = Column(Numeric(10, 2))
    kondicionirana_povrsina = Column(Numeric(10, 2))
    energijski_razred = Column(String(3))
    epbd_tip = Column(String(15))