"""
Visual Workflows Router
Handles listing, creation, retrieval, updating, deleting, status toggling,
session tracking, and interactive simulation for visual flowchart journeys.
"""

from datetime import datetime
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import auth
import models
import schemas
from database import get_db

logger = logging.getLogger("workflows_router")

router = APIRouter(prefix="/api/workflows", tags=["workflows"])


@router.get("", response_model=List[schemas.WorkflowFlowResponse])
def list_workflow_flows(
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    """Lists all visual journey workflows with execution metrics."""
    return db.query(models.WorkflowFlow).order_by(models.WorkflowFlow.id.asc()).all()


@router.post("", response_model=schemas.WorkflowFlowResponse, status_code=status.HTTP_201_CREATED)
def create_workflow_flow(
    payload: schemas.WorkflowFlowCreate,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    """Creates a new multi-step visual journey workflow."""
    flow = models.WorkflowFlow(
        name=payload.name,
        description=payload.description,
        trigger_type=payload.trigger_type,
        trigger_config=payload.trigger_config or {},
        nodes=payload.nodes or [],
        edges=payload.edges or [],
        is_active=payload.is_active,
        stats={"entered": 0, "completed": 0, "goals_converted": 0, "revenue_recovered": 0}
    )
    db.add(flow)
    db.commit()
    db.refresh(flow)
    return flow


@router.get("/{flow_id}", response_model=schemas.WorkflowFlowResponse)
def get_workflow_flow(
    flow_id: int,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    """Retrieves a single workflow with its complete node and edge graph."""
    flow = db.query(models.WorkflowFlow).filter(models.WorkflowFlow.id == flow_id).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Workflow flow not found")
    return flow


@router.put("/{flow_id}", response_model=schemas.WorkflowFlowResponse)
def update_workflow_flow(
    flow_id: int,
    payload: schemas.WorkflowFlowUpdate,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    """Updates a workflow's details, node positions, connections, and properties."""
    flow = db.query(models.WorkflowFlow).filter(models.WorkflowFlow.id == flow_id).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Workflow flow not found")

    if payload.name is not None:
        flow.name = payload.name
    if payload.description is not None:
        flow.description = payload.description
    if payload.trigger_type is not None:
        flow.trigger_type = payload.trigger_type
    if payload.trigger_config is not None:
        flow.trigger_config = payload.trigger_config
    if payload.nodes is not None:
        flow.nodes = payload.nodes
    if payload.edges is not None:
        flow.edges = payload.edges
    if payload.is_active is not None:
        flow.is_active = payload.is_active

    flow.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(flow)
    return flow


@router.delete("/{flow_id}")
def delete_workflow_flow(
    flow_id: int,
    current_user: models.User = Depends(auth.require_roles("admin")),
    db: Session = Depends(get_db)
):
    """Deletes a workflow and all associated execution sessions."""
    flow = db.query(models.WorkflowFlow).filter(models.WorkflowFlow.id == flow_id).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Workflow flow not found")

    db.query(models.WorkflowSession).filter(models.WorkflowSession.flow_id == flow_id).delete()
    db.delete(flow)
    db.commit()
    return {"status": "success", "message": f"Workflow flow #{flow_id} deleted successfully"}


@router.post("/{flow_id}/toggle", response_model=schemas.WorkflowFlowResponse)
def toggle_workflow_status(
    flow_id: int,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    """Toggles active/paused state for a workflow journey."""
    flow = db.query(models.WorkflowFlow).filter(models.WorkflowFlow.id == flow_id).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Workflow flow not found")

    flow.is_active = not flow.is_active
    db.commit()
    db.refresh(flow)
    return flow


def get_session_wa_sort_key(s: models.WorkflowSession):
    """Calculates sorting score: sessions with the most recently dispatched WhatsApp message rank at the top."""
    latest_wa_ts = None
    if s.state_data and isinstance(s.state_data, dict) and s.state_data.get("last_whatsapp_sent_at"):
        latest_wa_ts = s.state_data.get("last_whatsapp_sent_at")

    if not latest_wa_ts and s.history and isinstance(s.history, list):
        for h in reversed(s.history):
            if isinstance(h, dict):
                node_type = str(h.get("node_type", "")).lower()
                label = str(h.get("label", "")).lower()
                if "whatsapp" in node_type or "whatsapp" in label:
                    ts = h.get("timestamp")
                    if ts:
                        latest_wa_ts = ts
                        break

    wa_score = 0.0
    if latest_wa_ts:
        try:
            dt = datetime.fromisoformat(str(latest_wa_ts).replace("Z", "+00:00"))
            wa_score = dt.timestamp()
        except Exception:
            wa_score = 1.0

    upd_score = s.updated_at.timestamp() if s.updated_at else (s.created_at.timestamp() if s.created_at else float(s.id))
    return (1 if wa_score > 0 else 0, wa_score, upd_score, s.id)


@router.get("/{flow_id}/sessions", response_model=List[schemas.WorkflowSessionResponse])
def get_workflow_sessions(
    flow_id: int,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    """Returns the enrolled customer contacts and execution sessions traversing this workflow,
    ordered so whichever contact was sent a WhatsApp message most recently in the automation comes at the top."""
    sessions = (
        db.query(models.WorkflowSession)
        .filter(models.WorkflowSession.flow_id == flow_id)
        .all()
    )
    sessions.sort(key=get_session_wa_sort_key, reverse=True)
    return sessions[:250]


