import os
from sqlalchemy import QueuePool, create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")

engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=30,
    max_overflow=50,
    pool_pre_ping=True,
    pool_recycle=300,
    connect_args={
        "connect_timeout": 60,
        "options": "-c statement_timeout=300000"
    }
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_engine():
    return engine