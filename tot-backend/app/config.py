from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = Field(
        default="postgres://tot_api:tot_api_dev@localhost:5433/tot",
        validation_alias="DATABASE_URL_API",
    )
    cors_origins: str = Field(default="http://localhost:5173", validation_alias="CORS_ORIGINS")

    jwt_secret: str = Field(
        default="local-dev-jwt-secret-change-in-production",
        validation_alias="JWT_SECRET",
    )
    jwt_algorithm: str = Field(default="HS256", validation_alias="JWT_ALGORITHM")
    jwt_expire_minutes: int = Field(default=1440, validation_alias="JWT_EXPIRE_MINUTES")

    tot_user: str = Field(default="admin", validation_alias="TOT_USER")
    tot_password: str | None = Field(default="admin", validation_alias="TOT_PASSWORD")
    tot_password_hash: str | None = Field(default=None, validation_alias="TOT_PASSWORD_HASH")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
