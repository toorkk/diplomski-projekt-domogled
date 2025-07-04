from app.models import NpDelStavbe, KppDelStavbe, NpPosel, KppPosel

def test_np_del_stavbe_model():
    """Test da NP model ima pričakovane atribute"""
    assert hasattr(NpDelStavbe, 'del_stavbe_id')
    assert hasattr(NpDelStavbe, 'sifra_ko')
    assert hasattr(NpDelStavbe, 'obcina')
    assert hasattr(NpDelStavbe, 'coordinates')
    assert NpDelStavbe.__tablename__ == "np_del_stavbe"

def test_kpp_del_stavbe_model():
    """Test da KPP model ima pričakovane atribute"""
    assert hasattr(KppDelStavbe, 'del_stavbe_id')
    assert hasattr(KppDelStavbe, 'sifra_ko')
    assert hasattr(KppDelStavbe, 'stevilo_sob')  # KPP specific
    assert KppDelStavbe.__tablename__ == "kpp_del_stavbe"

def test_np_posel_model():
    """Test da NP posel model ima pričakovane atribute"""
    assert hasattr(NpPosel, 'posel_id')
    assert hasattr(NpPosel, 'najemnina')  # NP specific
    assert NpPosel.__tablename__ == "np_posel"

def test_kpp_posel_model():
    """Test da KPP posel model ima pričakovane atribute"""
    assert hasattr(KppPosel, 'posel_id')
    assert hasattr(KppPosel, 'cena')  # KPP specific
    assert KppPosel.__tablename__ == "kpp_posel"