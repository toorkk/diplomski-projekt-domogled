# backend/tests/conftest.py
import pytest
import sys
import os
from pathlib import Path

# Dodaj backend direktorij v Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from unittest.mock import Mock

from app.main import app

@pytest.fixture
def client():
    """Test client for API endpoints"""
    return TestClient(app)

@pytest.fixture
def mock_db():
    """Mock database session"""
    return Mock()