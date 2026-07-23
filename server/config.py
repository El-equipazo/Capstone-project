from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Database — set individual parts OR override with a full DATABASE_URL
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "quantumconnect"
    db_user: str = ""
    db_password: str = ""
    database_url: str = ""

    @model_validator(mode="after")
    def build_database_url(self) -> "Settings":
        if not self.database_url:
            if self.db_user and self.db_password:
                self.database_url = (
                    f"postgresql://{self.db_user}:{self.db_password}"
                    f"@{self.db_host}:{self.db_port}/{self.db_name}"
                )
            else:
                self.database_url = (
                    f"postgresql://{self.db_host}:{self.db_port}/{self.db_name}"
                )
        return self

    db_pool_min_size: int = 2
    db_pool_max_size: int = 10

    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30

    cors_origins: list[str] = ["http://localhost:5173"]

    # AI matching (POST /matching/recommendations). Optional — without a key
    # the server still runs; only the AI endpoint answers 503.
    # 'gemini-flash-latest' tracks the current flash model — pinned versions
    # (e.g. gemini-2.5-flash) get retired for new API keys over time.
    gemini_api_key: str = ""
    gemini_model: str = "gemini-flash-latest"


settings = Settings()
