import os

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "super-secret")

    # --- Email Settings ---
    MAIL_SERVER = os.environ.get("MAIL_SERVER", "smtp.gmail.com")
    MAIL_PORT = int(os.environ.get("MAIL_PORT", 587))
    MAIL_USE_TLS = os.environ.get("MAIL_USE_TLS", "true").lower() in ("true", "1")
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME")  # your email (e.g. noreply@dndwiki.com)
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD")  # app password or SMTP key
    MAIL_DEFAULT_SENDER = os.environ.get("MAIL_DEFAULT_SENDER", MAIL_USERNAME)
