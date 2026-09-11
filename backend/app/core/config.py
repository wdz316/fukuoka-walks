from pathlib import Path

from pydantic_settings import BaseSettings

_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    AI_PROVIDER: str = "rule"
    DATABASE_URL: str = "sqlite:///backend/data/app.db"
    UPLOAD_DIR: Path = _BACKEND_DIR / "data" / "uploads"

    model_config = {"env_prefix": "", "env_file": ".env", "extra": "ignore"}


settings = Settings()
