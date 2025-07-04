"""Osnovni testi da preverimo da aplikacija sploh deluje"""

def test_basic_math():
    """Test da pytest deluje"""
    assert 2 + 2 == 4

def test_app_import():
    """Test da se aplikacija lahko importira brez napak"""
    from app.main import app
    assert app is not None

def test_root_endpoint(client):
    """Test osnovnega endpoint-a"""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Domogled API"}