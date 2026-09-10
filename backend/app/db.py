from collections.abc import Generator

from sqlalchemy import Engine, create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


def run_migrations(bind: Engine) -> None:
    """Upgrade databases created by older app versions (idempotent).

    Creates any missing tables (e.g. ``visits``) and ALTERs legacy ``trips``
    tables that predate the ``status`` column. SQLite cannot add a ``NOT NULL``
    column without a constant default, so the column is added with
    ``DEFAULT 'planned'`` — existing rows read as ``planned``.
    """
    import app.models  # noqa: F401  # register tables on Base.metadata

    Base.metadata.create_all(bind=bind)
    if inspect(bind).has_table("trips"):
        columns = {c["name"] for c in inspect(bind).get_columns("trips")}
        if "status" not in columns:
            with bind.begin() as conn:
                conn.execute(
                    text(
                        "ALTER TABLE trips ADD COLUMN status VARCHAR(16) "
                        "NOT NULL DEFAULT 'planned'"
                    )
                )


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
