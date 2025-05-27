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
    ime_ko = Column(String(100))
    obcina = Column(String(100))
    stevilka_stavbe = Column(Integer)
    stevilka_dela_stavbe = Column(Integer)

    naselje = Column(String(100))
    ulica = Column(String(100))
    hisna_stevilka = Column(String(20))
    dodatek_hs = Column(String(10))
    stev_stanovanja = Column(Integer)
    vrsta = Column(SmallInteger)
    opremljenost = Column(SmallInteger)

    opombe = Column(Text)
    leto_izgradnje_stavbe = Column(Integer)
    dejanska_raba = Column(String(100))
    lega_v_stavbi = Column(String(20))

    povrsina = Column(Numeric(10, 2))
    povrsina_uporabna = Column(Numeric(10, 2))
    prostori = Column(Text)
    coordinates = Column(Geometry('Point', 4326))
    leto = Column(Integer)



class NpDelStavbeDeduplicated(Base):
    __tablename__ = "np_del_stavbe_deduplicated"
    __table_args__ = (
        UniqueConstraint('sifra_ko', 'stevilka_stavbe', 'stevilka_dela_stavbe', 'dejanska_raba', name='uq_stavbe_deduplicated'),
        {'schema': 'core'}
    )

    del_stavbe_id = Column(Integer, primary_key=True, autoincrement=True)
    
    # ID / composite ključ
    sifra_ko = Column(SmallInteger, nullable=False)
    stevilka_stavbe = Column(Integer, nullable=False)
    stevilka_dela_stavbe = Column(Integer, nullable=False)
    dejanska_raba = Column(String(310), nullable=False)
    
    povezani_del_stavbe_ids = Column(ARRAY(Integer), nullable=False)
    povezani_posel_ids = Column(ARRAY(Integer), nullable=False)
    najnovejsi_del_stavbe_id = Column(Integer, nullable=False)
    
    coordinates = Column(Geometry('Point', 4326), nullable=False)




class NpPosel(Base):
    __tablename__ = "np_posel"
    __table_args__ = {"schema": "core"}
    
    posel_id = Column(Integer, primary_key=True)
    vrsta_posla = Column(SmallInteger)
    datum_uveljavitve = Column(Date)
    datum_sklenitve = Column(Date)
    najemnina = Column(Numeric)
    vkljuceno_stroski = Column(Boolean)
    vkljuceno_ddv = Column(Boolean)
    stopnja_ddv = Column(Numeric(5, 2))
    datum_zacetka_najemanja = Column(Date)
    datum_prenehanja_najemanja = Column(Date)
    cas_najemanja = Column(Integer)
    trajanje_najemanja = Column(Integer)
    datum_zakljucka_najema = Column(Date)
    opombe = Column(Text)
    posredovanje_agencije = Column(Boolean)
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
    hisna_stevilka = Column(String(40))
    dodatek_hs = Column(String(10))
    stev_stanovanja = Column(Integer)
    vrsta = Column(SmallInteger)
    leto_izgradnje_dela_stavbe = Column(Integer)
    stavba_je_dokoncana = Column(Integer)
    gradbena_faza = Column(Integer)
    novogradnja = Column(Integer)
    prodana_povrsina = Column(Numeric(10, 2))
    prodani_delez = Column(String(199))
    prodana_povrsina_dela_stavbe = Column(Numeric(10, 2))
    prodana_uporabna_povrsina_dela_stavbe = Column(Numeric(10, 2))
    nadstropje = Column(String(50))
    stevilo_zunanjih_parkirnih_mest = Column(Integer)
    atrij = Column(Integer)
    povrsina_atrija = Column(Numeric(10, 2))
    opombe = Column(Text)
    dejanska_raba = Column(String(310))
    lega_v_stavbi = Column(String(20))
    stevilo_sob = Column(Integer)
    povrsina = Column(Numeric(10, 2))
    povrsina_uporabna = Column(Numeric(10, 2))
    prostori = Column(Text)
    pogodbena_cena = Column(Numeric(12, 2))
    stopnja_ddv = Column(Numeric(5, 2))
    
    coordinates = Column(Geometry('Point', 4326))
    leto = Column(Integer)



class KppDelStavbeDeduplicated(Base):
    __tablename__ = "kpp_del_stavbe_deduplicated"
    __table_args__ = (
        UniqueConstraint('sifra_ko', 'stevilka_stavbe', 'stevilka_dela_stavbe', 'dejanska_raba', name='uq_stavbe_deduplicated'),
        {'schema': 'core'}
    )

    del_stavbe_id = Column(Integer, primary_key=True, autoincrement=True)
    
    # ID / composite ključ
    sifra_ko = Column(SmallInteger, nullable=False)
    stevilka_stavbe = Column(Integer, nullable=False)
    stevilka_dela_stavbe = Column(Integer, nullable=False)
    dejanska_raba = Column(String(310), nullable=False)
    
    povezani_del_stavbe_ids = Column(ARRAY(Integer), nullable=False)
    povezani_posel_ids = Column(ARRAY(Integer), nullable=False)
    najnovejsi_del_stavbe_id = Column(Integer, nullable=False)
    
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
    posredovanje_agencije = Column(Boolean)
    trznost_posla = Column(SmallInteger)
    vrsta_akta = Column(SmallInteger)
    datum_zadnje_spremembe = Column(Date)
    datum_zadnje_uveljavitve = Column(Date)
    leto = Column(Integer)