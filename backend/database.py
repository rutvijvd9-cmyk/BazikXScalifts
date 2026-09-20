import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

import config

DATABASE_URL = config.DATABASE_URL
if not DATABASE_URL:
    if config.ENVIRONMENT == "production":
        raise RuntimeError("FATAL: DATABASE_URL is not configured for production.")
    DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/whatsapp_crm"

# Fix SQLAlchemy requirement: SQLAlchemy requires 'postgresql://' instead of legacy 'postgres://'
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Fail closed if production database connects to localhost or sqlite
if config.ENVIRONMENT == "production":
    url_lower = DATABASE_URL.lower()
    if "localhost" in url_lower or "127.0.0.1" in url_lower or url_lower.startswith("sqlite"):
        raise RuntimeError(
            "FATAL: Production database must be a remote PostgreSQL instance with TLS enabled. "
            "Localhost and SQLite are strictly prohibited in production."
        )

# Enable connection pooling and pre-ping to handle serverless/cloud DB reconnects gracefully
engine_options = {"pool_pre_ping": True, "pool_recycle": 300}
if DATABASE_URL.startswith("sqlite"):
    engine_options["connect_args"] = {"check_same_thread": False}
elif DATABASE_URL.startswith("postgresql"):
    connect_args = {}
    if config.ENVIRONMENT == "production":
        sslmode = os.getenv("DB_SSLMODE", "require").strip()
        connect_args["sslmode"] = sslmode
        sslrootcert = os.getenv("DB_SSLROOTCERT")
        if sslrootcert:
            connect_args["sslrootcert"] = sslrootcert
        sslcert = os.getenv("DB_SSLCERT")
        if sslcert:
            connect_args["sslcert"] = sslcert
        sslkey = os.getenv("DB_SSLKEY")
        if sslkey:
            connect_args["sslkey"] = sslkey
    if connect_args:
        engine_options["connect_args"] = connect_args

engine = create_engine(DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
