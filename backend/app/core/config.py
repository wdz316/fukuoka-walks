from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    AI_PROVIDER: str = "rule"
    DATABASE_URL: str = "sqlite:///backend/data/app.db"

    model_config = {"env_prefix": "", "env_file": ".env", "extra": "ignore"}


settings = Settings()
