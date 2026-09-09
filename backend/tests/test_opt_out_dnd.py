import pytest
from fastapi import status
import models
import whatsapp_service

def test_meta_webhook_challenge(client):
    res = client.get("/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=manubhai_meta_verify_token_123&hub.challenge=11223344")
    assert res.status_code == status.HTTP_200_OK
    assert res.text == "11223344"

def test_inbound_stop_keyword_english(client, db):
    phone = "+919811122233"
    db.query(models.OptOut).filter(models.OptOut.phone == phone).delete()
    db.commit()

    payload = {
        "entry": [{
            "changes": [{
                "value": {
                    "messages": [{
                        "from": phone.replace("+", ""),
                        "type": "text",
                        "text": {"body": "STOP please"}
                    }]
                }
            }]
        }]
    }
    res = client.post("/api/webhooks/whatsapp", json=payload)
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["status"] == "opted_out"

    # Verify present in DND table
    opt = db.query(models.OptOut).filter(models.OptOut.phone == phone).first()
    assert opt is not None

def test_inbound_stop_keyword_gujarati(client, db):
    phone = "+919811122244"
    db.query(models.OptOut).filter(models.OptOut.phone == phone).delete()
    db.commit()

    payload = {
        "entry": [{
            "changes": [{
                "value": {
                    "messages": [{
                        "from": phone.replace("+", ""),
                        "type": "text",
                        "text": {"body": "સંદેશા બંધ કરો"}
                    }]
                }
            }]
        }]
    }
    res = client.post("/api/webhooks/whatsapp", json=payload)
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["status"] == "opted_out"

    # Verify present in DND table
    opt = db.query(models.OptOut).filter(models.OptOut.phone == phone).first()
    assert opt is not None

def test_dnd_blocks_outbound_dispatch(db):
    blocked_phone = "+919811122233"
    res = whatsapp_service.send_whatsapp_template(
        recipient_phone=blocked_phone,
        template_name="festive_promo_offer",
        language="en"
    )
    assert res["status"] == "blocked"
    assert "opted out" in res["reason"]
