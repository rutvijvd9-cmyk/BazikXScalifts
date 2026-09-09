import pytest
from fastapi import status

def test_login_success(client, db):
    # Ensure test user exists
    res = client.post("/api/auth/login", json={
        "username": "test_admin",
        "password": "SecretPassword123!"
    })
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_login_invalid_password(client):
    res = client.post("/api/auth/login", json={
        "username": "test_admin",
        "password": "WrongPassword!"
    })
    assert res.status_code == status.HTTP_401_UNAUTHORIZED

def test_protected_routes_require_jwt(client):
    # Request without header must fail
    res = client.get("/api/campaigns")
    assert res.status_code == status.HTTP_401_UNAUTHORIZED

def test_protected_routes_accept_jwt(client, auth_headers):
    # Request with valid bearer token must pass
    res = client.get("/api/campaigns", headers=auth_headers)
    assert res.status_code == status.HTTP_200_OK
