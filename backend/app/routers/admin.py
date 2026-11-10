from datetime import date, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Appointment, DoctorProfile, User
from app.routers.doctor import upcoming_bookings
from app.schemas import AdminDoctorOut, AdminStatsOut, DoctorProfileOut, ReasonIn
from app.security import require_role

current_admin = require_role("admin")
router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(current_admin)])

# Shown to patients whose booking is cancelled because the doctor was rejected
REJECTED_DOCTOR_REASON = "This doctor is no longer taking appointments on MedConnect PK"


def admin_doctor(db, profile):
    profile_data = DoctorProfileOut.model_validate(profile).model_dump()
    return AdminDoctorOut(
        **profile_data,
        full_name=profile.user.full_name,
        email=profile.user.email,
        reviewed_by_name=profile.reviewer.full_name if profile.reviewer else None,
        reviewed_at=profile.reviewed_at,
        has_hours=len(profile.availability) > 0,
        upcoming_appointments=len(upcoming_bookings(db, profile)),
    )


def verified_doctors():
    # A sign up that never verified its email is not a real application yet
    return select(DoctorProfile).join(DoctorProfile.user).where(User.is_verified.is_(True))


def find_profile(db, doctor_id):
    profile = db.scalar(verified_doctors().where(DoctorProfile.id == doctor_id))
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
            verified_doctors().where(DoctorProfile.approval_status == "approved")
        ),
        "pending_approvals": count(
            verified_doctors().where(DoctorProfile.approval_status == "pending")
        ),
    }


@router.get("/doctors", response_model=list[AdminDoctorOut])
def list_doctors(
    status: Literal["pending", "approved", "rejected"] = "pending", db: Session = Depends(get_db)
):
    # Oldest submissions first, so the queue is reviewed in order
    profiles = db.scalars(
        verified_doctors()
        .where(DoctorProfile.approval_status == status)
        .order_by(DoctorProfile.submitted_at)
    ).all()
    return [admin_doctor(db, profile) for profile in profiles]


@router.post("/doctors/{doctor_id}/approve", response_model=AdminDoctorOut)
def approve_doctor(
    doctor_id: int, admin: User = Depends(current_admin), db: Session = Depends(get_db)
):
    profile = find_profile(db, doctor_id)
    profile.approval_status = "approved"
    profile.rejection_reason = None
    profile.reviewer = admin
    profile.reviewed_at = datetime.now()
    db.commit()
    return admin_doctor(db, profile)


@router.post("/doctors/{doctor_id}/reject", response_model=AdminDoctorOut)
def reject_doctor(
    doctor_id: int,
    data: ReasonIn,
    admin: User = Depends(current_admin),
    db: Session = Depends(get_db),
):
    profile = find_profile(db, doctor_id)
    profile.approval_status = "rejected"
    profile.rejection_reason = data.reason
    profile.reviewer = admin
    profile.reviewed_at = datetime.now()

    # Patients must not travel to a doctor the admin has removed, so their bookings are cancelled
    for appointment in upcoming_bookings(db, profile):
        appointment.status = "cancelled"
        appointment.cancelled_by = "admin"
        appointment.cancel_reason = REJECTED_DOCTOR_REASON

    db.commit()
    return admin_doctor(db, profile)
