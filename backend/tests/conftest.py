import pytest
from fastapi.testclient import TestClient
from database import SessionLocal, Base, engine
import models
import auth
from main import app

@pytest.fixture(scope="session", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield

@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture(autouse=True)
def seed_test_admin(db):
    admin = db.query(models.User).filter(models.User.username == "test_admin").first()
    if not admin:
        admin = models.User(
            username="test_admin",
            email="test_admin@example.com",
            hashed_password=auth.get_password_hash("SecretPassword123!"),
            is_active=True
        )
        db.add(admin)
        db.commit()

@pytest.fixture
def auth_headers():
    token = auth.create_access_token(data={"sub": "test_admin"})
    return {"Authorization": f"Bearer {token}"}
