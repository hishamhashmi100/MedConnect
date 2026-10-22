from datetime import date, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Appointment, DoctorProfile, User
from app.schemas import AdminDoctorOut, AdminStatsOut, DoctorProfileOut, RejectIn
from app.security import require_role

router = APIRouter(
    prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_role("admin"))]
)


def admin_doctor(profile):
    profile_data = DoctorProfileOut.model_validate(profile).model_dump()
    return AdminDoctorOut(
        **profile_data, full_name=profile.user.full_name, email=profile.user.email
    )


def find_profile(db, doctor_id):
    profile = db.get(DoctorProfile, doctor_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return profile


@router.get("/stats", response_model=AdminStatsOut)
def stats(db: Session = Depends(get_db)):
    month_start = date.today().replace(day=1)
    next_month_start = (month_start + timedelta(days=32)).replace(day=1)

    def count(query):
        return db.scalar(select(func.count()).select_from(query.subquery()))

    patients = select(User).where(User.role == "patient", User.is_verified.is_(True))
    return {
        "patients": count(patients),
        "new_patients_this_month": count(
            patients.where(User.created_at >= datetime.combine(month_start, datetime.min.time()))
        ),
        # Appointments taking place this month, not counting cancelled ones
        "appointments_this_month": count(
            select(Appointment).where(
                Appointment.date >= month_start,
                Appointment.date < next_month_start,
                Appointment.status != "cancelled",
            )
        ),
        "approved_doctors": count(
            select(DoctorProfile).where(DoctorProfile.approval_status == "approved")
        ),
        "pending_approvals": count(
            select(DoctorProfile).where(DoctorProfile.approval_status == "pending")
        ),
    }


@router.get("/doctors", response_model=list[AdminDoctorOut])
def list_doctors(
    status: Literal["pending", "approved", "rejected"] = "pending", db: Session = Depends(get_db)
):
    # Oldest submissions first, so the queue is reviewed in order
    profiles = db.scalars(
        select(DoctorProfile)
        .where(DoctorProfile.approval_status == status)
        .order_by(DoctorProfile.submitted_at)
    ).all()
    return [admin_doctor(profile) for profile in profiles]


@router.post("/doctors/{doctor_id}/approve", response_model=AdminDoctorOut)
def approve_doctor(doctor_id: int, db: Session = Depends(get_db)):
    profile = find_profile(db, doctor_id)
    profile.approval_status = "approved"
    profile.rejection_reason = None
    db.commit()
    return admin_doctor(profile)


@router.post("/doctors/{doctor_id}/reject", response_model=AdminDoctorOut)
def reject_doctor(doctor_id: int, data: RejectIn, db: Session = Depends(get_db)):
    profile = find_profile(db, doctor_id)
    profile.approval_status = "rejected"
    profile.rejection_reason = data.reason
    db.commit()
    return admin_doctor(profile)
