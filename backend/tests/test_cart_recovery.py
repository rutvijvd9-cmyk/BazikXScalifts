import pytest
import uuid
import hashlib
import hmac
import json
from fastapi import status
import models

def test_cart_event_webhook(client, auth_headers, db):
    unique_token = f"cart_test_{uuid.uuid4().hex[:8]}"
    payload = {
        "cart_token": unique_token,
        "customer_phone": "+919876543210",
        "cart_value": 450.0,
        "items": [{"item": "Nylon Papdi Gathiya", "qty": 1}]
    }
    res = client.post("/api/webhooks/cart-event?delay_seconds=1800", json=payload, headers=auth_headers)
    assert res.status_code == status.HTTP_202_ACCEPTED
    data = res.json()
    assert data["status"] == "received"

    # Verify cart event in DB is freshly created as PENDING
    cart = db.query(models.CartEvent).filter(models.CartEvent.cart_token == unique_token).first()
    assert cart is not None
    assert cart.status == "PENDING"


def test_store_webhook_requires_valid_signature(client):
    payload = {
        "cart_token": f"cart_signed_{uuid.uuid4().hex[:8]}",
        "customer_phone": "+919876543211",
        "cart_value": 450.0,
        "items": []
    }
    raw_body = json.dumps(payload).encode()
    signature = "sha256=" + hmac.new(
        b"test-store-webhook-secret", raw_body, hashlib.sha256
    ).hexdigest()
    accepted = client.post(
        "/api/webhooks/cart-event",
        content=raw_body,
        headers={"Content-Type": "application/json", "X-Hub-Signature-256": signature},
    )
    assert accepted.status_code == status.HTTP_202_ACCEPTED

    rejected = client.post("/api/webhooks/cart-event", json=payload)
    assert rejected.status_code == status.HTTP_401_UNAUTHORIZED

def test_order_completion_cancels_recovery(client, auth_headers, db):
    unique_token = f"cart_test_{uuid.uuid4().hex[:8]}"
    # Create fresh cart
    client.post("/api/webhooks/cart-event?delay_seconds=1800", json={
        "cart_token": unique_token,
        "customer_phone": "+919876543210",
        "cart_value": 300.0,
        "items": []
    }, headers=auth_headers)

    # Simulate customer purchasing
    res = client.post(
        f"/api/webhooks/order-completed?cart_token={unique_token}&customer_phone=%2B919876543210",
        headers=auth_headers
    )
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["status"] == "success"

    # Verify marked as RECOVERED in DB
    cart = db.query(models.CartEvent).filter(models.CartEvent.cart_token == unique_token).first()
    assert cart.status == "RECOVERED"
