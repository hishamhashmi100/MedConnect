from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.database import Base, engine, get_db
from app.routers import admin, appointments, auth, doctor, doctors, meta


@asynccontextmanager
async def lifespan(app):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="MedConnect PK API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(meta.router)
app.include_router(doctor.router)
app.include_router(doctors.router)
app.include_router(appointments.router)
app.include_router(admin.router)


@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    # A quick query so this also tells us the database is reachable
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "ok"}
