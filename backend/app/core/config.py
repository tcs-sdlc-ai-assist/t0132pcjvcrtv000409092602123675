"""Application configuration loaded from environment variables."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Typed runtime settings for the Meridian API."""

    database_url: str = "sqlite+aiosqlite:///./data/meridian.db"
    jwt_secret: str = "dev-secret-change-in-production"
    jwt_expire_minutes: int = 60
    seed_on_startup: bool = True

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    """Return the cached application settings instance."""

    return Settings()
