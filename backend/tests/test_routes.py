import pytest
from unittest.mock import patch

def test_health_check(client):
    """Test osnovnega health check-a"""
    response = client.get("/")
    assert response.status_code == 200

@patch('app.routes.DelStavbeService.get_distance_clustered_del_stavbe')
def test_geojson_endpoint_basic(mock_service, client):
    """Test osnovnega GeoJSON endpoint-a"""
    # Mock return value
    mock_service.return_value = {
        "type": "FeatureCollection",
        "features": []
    }
    
    response = client.get("/properties/geojson?bbox=14,46,15,47&zoom=10&data_source=np")
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "FeatureCollection"
    assert "features" in data

def test_geojson_invalid_bbox(client):
    """Test napačnega bbox parametra"""
    response = client.get("/properties/geojson?bbox=invalid&zoom=10")
    assert response.status_code == 400

def test_geojson_invalid_data_source(client):
    """Test napačnega data_source parametra"""
    response = client.get("/properties/geojson?bbox=14,46,15,47&zoom=10&data_source=invalid")
    assert response.status_code == 400

@patch('app.routes.DelStavbeService.get_del_stavbe_details')
def test_property_details_not_found(mock_service, client):
    """Test ko nepremičnina ni najdena"""
    mock_service.return_value = None
    
    response = client.get("/property-details/999?data_source=np")
    assert response.status_code == 404