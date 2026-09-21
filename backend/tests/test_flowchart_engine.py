import pytest
import json
import hmac
import hashlib
from datetime import datetime, timedelta
import models
import auth
from scheduler import start_workflow_session, process_workflow_session_step


def test_list_and_create_workflow(client, auth_headers, db):
    # 1. Test listing (should include seeded or empty)
    res = client.get("/api/workflows", headers=auth_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)

    # 2. Test creating new custom journey flow
    new_flow_payload = {
        "name": "Custom VIP Test Flow",
        "description": "VIP repeat buyer appreciation journey",
        "trigger_type": "ORDER_COUNT_VIP",
        "trigger_config": {"min_orders": 2},
        "is_active": True,
        "nodes": [
            {
                "id": "t1",
                "type": "trigger",
                "label": "VIP Repeat Trigger",
                "position": {"x": 200, "y": 40},
                "data": {"trigger_type": "ORDER_COUNT_VIP"}
            },
            {
                "id": "a1",
                "type": "whatsapp_message",
                "label": "Send VIP Tasting Invite",
                "position": {"x": 200, "y": 180},
                "data": {"template_name": "vip_exclusive_offer", "coupon_code": "VIPSPECIAL"}
            },
            {
                "id": "e1",
                "type": "exit",
                "label": "VIP Journey Done",
                "position": {"x": 200, "y": 320},
                "data": {"outcome": "GOAL_MET"}
            }
        ],
        "edges": [
            {"id": "e-t1-a1", "source": "t1", "target": "a1"},
            {"id": "e-a1-e1", "source": "a1", "target": "e1"}
        ]
    }
    create_res = client.post("/api/workflows", json=new_flow_payload, headers=auth_headers)
    assert create_res.status_code == 201
    data = create_res.json()
    assert data["name"] == "Custom VIP Test Flow"
    assert len(data["nodes"]) == 3
    assert len(data["edges"]) == 2


def test_simulate_workflow_is_removed(client, auth_headers, db):
    flow_id = 1
    # Verify simulation endpoint was completely removed
    res = client.post("/api/workflows/1/simulate", json={}, headers=auth_headers)
    assert res.status_code in [404, 405]

    # Check sessions endpoint
    sess_res = client.get(f"/api/workflows/{flow_id}/sessions", headers=auth_headers)
    assert sess_res.status_code == 200
    assert isinstance(sess_res.json(), list)


def test_workflow_engine_condition_branching(db):
    """
    Tests engine execution with condition branching:
    Trigger -> Delay -> Condition (ORDER_PLACED)
    YES -> Tag (VIP) -> Exit (GOAL_MET)
    NO -> Exit (DROPOUT)
    """
    test_flow = models.WorkflowFlow(
        name="Test Condition Branching Flow",
        trigger_type="ABANDONED_CART",
        is_active=True,
        nodes=[
            {"id": "n1", "type": "trigger", "label": "Start", "data": {}},
            {"id": "n2", "type": "delay", "label": "Wait 15m", "data": {"delay_minutes": 15}},
            {"id": "n3", "type": "condition", "label": "Purchased?", "data": {"condition_type": "ORDER_PLACED"}},
            {"id": "n4_yes", "type": "tag", "label": "Tag VIP", "data": {"tag_name": "Recovered Patron"}},
            {"id": "n5_goal", "type": "exit", "label": "Goal Reached", "data": {"outcome": "GOAL_MET"}},
            {"id": "n6_no", "type": "exit", "label": "Dropout", "data": {"outcome": "DROPOUT"}}
        ],
        edges=[
            {"id": "e1", "source": "n1", "target": "n2"},
            {"id": "e2", "source": "n2", "target": "n3"},
            {"id": "e3_yes", "source": "n3", "target": "n4_yes", "sourceHandle": "yes"},
            {"id": "e4_goal", "source": "n4_yes", "target": "n5_goal"},
            {"id": "e5_no", "source": "n3", "target": "n6_no", "sourceHandle": "no"}
        ],
        stats={"entered": 0, "completed": 0, "goals_converted": 0, "revenue_recovered": 0}
    )
    db.add(test_flow)
    db.commit()
    db.refresh(test_flow)

    phone = "+919876540000"
    # Ensure contact exists
    contact = db.query(models.Contact).filter(models.Contact.phone == phone).first()
    if not contact:
        contact = models.Contact(phone=phone, name="Test Branch Patron")
        db.add(contact)
        db.commit()

    # Scenario A: Order is NOT placed -> Should branch to NO (Dropout)
    sess_no = start_workflow_session(
        flow_id=test_flow.id,
        customer_phone=phone,
        state_data={"cart_token": "cart_no_order", "order_placed": False},
        db=db
    )
    assert sess_no is not None
    # Trigger moved it to delay (n2), status is WAITING_DELAY
    assert sess_no.status == "WAITING_DELAY"
    assert sess_no.current_node_id == "n2"

    # Fast forward delay timer and execute
    sess_no.next_evaluation_at = datetime.utcnow() - timedelta(minutes=1)
    db.commit()
    process_workflow_session_step(sess_no.id, db=db, mock_send=True)
    db.refresh(sess_no)
    # Should have traversed: Delay expired -> Condition n3 -> NO branch -> n6_no Exit (DROPOUT)
    assert sess_no.status == "COMPLETED_DROPOUT"

    # Scenario B: Order IS placed -> Should branch to YES (Tag VIP -> Goal)
    sess_yes = start_workflow_session(
        flow_id=test_flow.id,
        customer_phone=phone,
        state_data={"cart_token": "cart_with_order", "order_placed": True, "cart_value": 600.0},
        db=db
    )
    # Fast forward delay
    sess_yes.next_evaluation_at = datetime.utcnow() - timedelta(minutes=1)
    db.commit()
    process_workflow_session_step(sess_yes.id, db=db, mock_send=True)
    db.refresh(sess_yes)
    assert sess_yes.status == "COMPLETED_GOAL"
    db.refresh(contact)
    assert "Recovered Patron" in (contact.tags or "")


def test_cart_event_webhook_enrolls_workflow(client, db):
    # Ensure service account exists
    svc = db.query(models.User).filter(models.User.username == "ecom_service").first()
    if not svc:
        svc = models.User(
            username="ecom_service",
            email="ecom_service@example.com",
            hashed_password=auth.get_password_hash("ServicePass123!"),
            is_active=True,
            role="service"
        )
        db.add(svc)
        db.commit()

    svc_token = auth.create_access_token(data={"sub": "ecom_service", "role": "service"})
    headers = {"Authorization": f"Bearer {svc_token}"}

    # Ensure an active ABANDONED_CART workflow exists
    active_wf = db.query(models.WorkflowFlow).filter(
        models.WorkflowFlow.trigger_type == "ABANDONED_CART",
        models.WorkflowFlow.is_active == True
    ).first()
    if not active_wf:
        active_wf = models.WorkflowFlow(
            name="Active Cart Recovery Flow",
            trigger_type="ABANDONED_CART",
            is_active=True,
            nodes=[
                {"id": "t1", "type": "trigger", "label": "Trigger", "data": {}},
                {"id": "e1", "type": "exit", "label": "Exit", "data": {"outcome": "GOAL_MET"}}
            ],
            edges=[{"id": "e1", "source": "t1", "target": "e1"}],
            stats={"entered": 0, "completed": 0, "goals_converted": 0, "revenue_recovered": 0}
        )
        db.add(active_wf)
        db.commit()

    cart_payload = {
        "cart_token": f"cart_wf_test_{int(datetime.utcnow().timestamp())}",
        "customer_phone": "+919123456780",
        "cart_value": 850.0,
        "items": [{"item": "Nylon Khaman"}, {"item": "Bhavnagari Gathiya"}]
    }

    raw_body = json.dumps(cart_payload).encode()
    signature = "sha256=" + hmac.new(
        b"test-store-webhook-secret", raw_body, hashlib.sha256
    ).hexdigest()
    hmac_headers = {"Content-Type": "application/json", "X-Hub-Signature-256": signature}

    res = client.post("/api/webhooks/cart-event?delay_seconds=1800", content=raw_body, headers=hmac_headers)
    assert res.status_code == 202
    data = res.json()
    assert data["status"] == "received"
    assert "workflow_session_id" in data


def test_clear_workflow_queue(client, auth_headers, db):
    # Create test flow
    flow = models.WorkflowFlow(
        name="Clear Queue Test Flow",
        trigger_type="ABANDONED_CART",
        is_active=True,
        nodes=[{"id": "t1", "type": "trigger", "label": "T"}],
        edges=[],
        stats={"entered": 5, "completed": 2, "goals_converted": 1, "revenue_recovered": 500}
    )
    db.add(flow)
    db.commit()
    db.refresh(flow)

    # Add active, waiting, and completed sessions
    s1 = models.WorkflowSession(flow_id=flow.id, customer_phone="+919999900001", status="ACTIVE")
    s2 = models.WorkflowSession(flow_id=flow.id, customer_phone="+919999900002", status="WAITING_DELAY")
    s3 = models.WorkflowSession(flow_id=flow.id, customer_phone="+919999900003", status="COMPLETED_GOAL")
    db.add_all([s1, s2, s3])
    db.commit()

    # Add an outbound message referencing session s1 to verify FK unlinking works without error
    out_msg = models.OutboundMessage(
        idempotency_key="out_msg_test_clear_queue",
        recipient_phone_e164="+919999900001",
        recipient_hash="hash12345",
        message_kind="template",
        purpose="utility",
        workflow_session_id=s1.id,
        status="sent"
    )
    cart_evt = models.CartEvent(
        cart_token="cart_clear_test_token",
        customer_phone="+919999900001",
        cart_value=500.0
    )
    db.add_all([out_msg, cart_evt])
    db.commit()

    # 1. Test mode="cancel_active"
    res = client.post(f"/api/workflows/{flow.id}/clear-queue?mode=cancel_active", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["cleared_count"] == 2  # s1 and s2

    db.refresh(s1)
    db.refresh(s2)
    db.refresh(s3)
    assert s1.status == "CANCELLED"
    assert s2.status == "CANCELLED"
    assert s3.status == "COMPLETED_GOAL"

    # 2. Test mode="delete_all" with clear_stats=True and clear_cart_events=True
    res2 = client.post(
        f"/api/workflows/{flow.id}/clear-queue?mode=delete_all&clear_stats=true&clear_cart_events=true",
        headers=auth_headers
    )
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["status"] == "success"
    assert data2["cleared_count"] == 3  # all 3 deleted
    assert data2["stats_reset"] is True
    assert data2["cleared_cart_events"] >= 1

    remaining = db.query(models.WorkflowSession).filter(models.WorkflowSession.flow_id == flow.id).count()
    assert remaining == 0
    db.refresh(flow)
    assert flow.stats["entered"] == 0

    # Verify OutboundMessage has been cleanly unlinked (workflow_session_id set to NULL)
    db.refresh(out_msg)
    assert out_msg.workflow_session_id is None
