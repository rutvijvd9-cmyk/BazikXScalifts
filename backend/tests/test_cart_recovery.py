import pytest
import uuid
from fastapi import status
import models

def test_cart_event_webhook(client, db):
    unique_token = f"cart_test_{uuid.uuid4().hex[:8]}"
    payload = {
        "cart_token": unique_token,
        "customer_phone": "+919876543210",
        "cart_value": 450.0,
        "items": [{"item": "Nylon Papdi Gathiya", "qty": 1}]
    }
    res = client.post("/api/webhooks/cart-event?delay_seconds=1800", json=payload)
    assert res.status_code == status.HTTP_202_ACCEPTED
    data = res.json()
    assert data["status"] == "received"

    # Verify cart event in DB is freshly created as PENDING
    cart = db.query(models.CartEvent).filter(models.CartEvent.cart_token == unique_token).first()
    assert cart is not None
    assert cart.status == "PENDING"

def test_order_completion_cancels_recovery(client, db):
    unique_token = f"cart_test_{uuid.uuid4().hex[:8]}"
    # Create fresh cart
    client.post("/api/webhooks/cart-event?delay_seconds=1800", json={
        "cart_token": unique_token,
        "customer_phone": "+919876543210",
        "cart_value": 300.0,
        "items": []
    })

    # Simulate customer purchasing
    res = client.post(
        f"/api/webhooks/order-completed?cart_token={unique_token}&customer_phone=%2B919876543210"
    )
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["status"] == "success"

    # Verify marked as RECOVERED in DB
    cart = db.query(models.CartEvent).filter(models.CartEvent.cart_token == unique_token).first()
    assert cart.status == "RECOVERED"
