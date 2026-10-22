import os
from pathlib import Path

import pytest
from dotenv import dotenv_values
from fastapi.testclient import TestClient

# These settings must be in place before the app is imported, because the app reads them on import.
# Tests use their own database so they never touch the demo data.
ENV = dotenv_values(Path(__file__).resolve().parent.parent / ".env")
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL") or ENV.get("TEST_DATABASE_URL")
if not TEST_DATABASE_URL:
    pytest.exit("Set TEST_DATABASE_URL in backend/.env to run the tests (see SETUP.md)")
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
# With no SMTP user the codes are printed, so tests never send real email
os.environ["SMTP_USER"] = ""

from app.database import Base, SessionLocal, engine
from app.main import app


@pytest.fixture
def db():
    # Every test starts from empty tables
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        yield session


@pytest.fixture
def client(db):
    with TestClient(app) as test_client:
        yield test_client
