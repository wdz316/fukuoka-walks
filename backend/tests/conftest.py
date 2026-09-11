import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401  # register tables on Base before create_all
from app.core.config import settings
from app.db import Base, get_db
from app.main import create_app
from app.seed import seed_destinations

TEST_DATABASE_URL = "sqlite://"


@pytest.fixture()
def client(tmp_path: Path) -> TestClient:
    db_file = tmp_path / "test.db"
    engine = create_engine(f"sqlite:///{db_file}", connect_args={"check_same_thread": False})
    TestSession = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestSession() as seed_db:
        seed_destinations(seed_db)

    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)
    settings.UPLOAD_DIR = upload_dir

    def _override_get_db() -> None:
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app = create_app()
    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
