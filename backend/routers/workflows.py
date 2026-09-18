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
    current_user: models.User = Depends(auth.get_current_user),
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
    current_user: models.User = Depends(auth.get_current_user),
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


@router.get("/{flow_id}/sessions", response_model=List[schemas.WorkflowSessionResponse])
def get_workflow_sessions(
    flow_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Returns the enrolled customer contacts and execution sessions traversing this workflow."""
    return (
        db.query(models.WorkflowSession)
        .filter(models.WorkflowSession.flow_id == flow_id)
        .order_by(models.WorkflowSession.id.desc())
        .limit(250)
        .all()
    )


@router.post("/{flow_id}/simulate")
def simulate_workflow_flow(
    flow_id: int,
    payload: schemas.WorkflowSimulateRequest,
    current_user: models.User = Depends(auth.require_roles("admin", "manager")),
    db: Session = Depends(get_db)
):
    """
    Test-runs a workflow flow immediately for a designated phone number.
    Executes initial trigger and actions, recording steps in session history.
    """
    flow = db.query(models.WorkflowFlow).filter(models.WorkflowFlow.id == flow_id).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Workflow flow not found")

    from scheduler import start_workflow_session, process_workflow_session_step

    sim_token = f"sim_{int(datetime.utcnow().timestamp())}"
    state_data = {
        "cart_token": sim_token,
        "cart_value": payload.test_cart_value or 450.0,
        "customer_name": "Test Patron",
        "items_summary": "Special Vanela Gathiya & Bhavnagari Gathiya",
        "simulation": True,
        "simulated_by": current_user.username
    }

    session = start_workflow_session(
        flow_id=flow.id,
        customer_phone=payload.customer_phone,
        state_data=state_data,
        db=db
    )

    if not session:
        raise HTTPException(status_code=500, detail="Failed to initialize workflow session")

    if payload.mock_mode and session.status == "WAITING_DELAY":
        session.status = "ACTIVE"
        db.commit()
        process_workflow_session_step(session.id, db=db, mock_send=True)

    db.refresh(session)
    return {
        "status": "success",
        "message": f"Simulation initiated for {payload.customer_phone} in '{flow.name}'",
        "session_id": session.id,
        "current_status": session.status,
        "history": session.history or []
    }
