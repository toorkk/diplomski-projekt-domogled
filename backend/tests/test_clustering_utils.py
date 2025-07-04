# backend/tests/test_clustering_utils.py
import pytest
from unittest.mock import Mock
from decimal import Decimal
from datetime import date

from app.clustering_utils import (
    calculate_cluster_resolution,
    serialize_to_json,
    serialize_list_to_json
)

def test_calculate_cluster_resolution():
    """Test izračuna cluster resolution"""
    # Test da funkcija vrne pričakovane vrednosti
    assert calculate_cluster_resolution(12.0) == pytest.approx(0.01)  # base case
    assert calculate_cluster_resolution(6.0) > calculate_cluster_resolution(15.0)  # manjši zoom = večji clustri

def test_serialize_to_json_basic():
    """Test osnovne serializacije"""
    # Mock SQLAlchemy objekt
    mock_obj = Mock()
    mock_obj.__table__ = Mock()
    
    # Mock stolpec z string vrednostjo
    col = Mock()
    col.name = "test_field"
    mock_obj.__table__.columns = [col]
    setattr(mock_obj, "test_field", "test_value")
    
    result = serialize_to_json(mock_obj)
    assert result["test_field"] == "test_value"

def test_serialize_to_json_decimal():
    """Test serializacije Decimal vrednosti"""
    mock_obj = Mock()
    mock_obj.__table__ = Mock()
    
    col = Mock()
    col.name = "price"
    mock_obj.__table__.columns = [col]
    setattr(mock_obj, "price", Decimal("150000.50"))
    
    result = serialize_to_json(mock_obj)
    assert result["price"] == pytest.approx(150000.5)  # Uporabi pytest.approx

def test_serialize_to_json_none():
    """Test serializacije None vrednosti"""
    result = serialize_to_json(None)
    assert result is None

def test_serialize_list_empty():
    """Test serializacije praznega seznama"""
    assert serialize_list_to_json([]) == []
    assert serialize_list_to_json(None) == []