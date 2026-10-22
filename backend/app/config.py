from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Always read backend/.env, no matter which folder uvicorn is started from
ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")

    database_url: str
    frontend_url: str = "http://localhost:5173"

    jwt_secret: str
    jwt_expire_minutes: int = 1440

    # Leave smtp_user empty to print OTP codes to the console instead of emailing them
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""

    # Turns on the one-click "Explore the patient demo" login
    demo_mode: bool = False


settings = Settings()
