from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str = "postgresql://localhost/quantumconnect"
    db_pool_min_size: int = 2
    db_pool_max_size: int = 10

    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30

    # Comma-separated origins accepted; default covers the Vite dev server
    cors_origins: list[str] = ["http://localhost:5173"]


settings = Settings()
