from datetime import date as dt_date
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import DAY_NAMES
from app.database import get_db
from app.models import Appointment, Availability, DoctorProfile, User
from app.schemas import (
    AppointmentStatusIn,
    AvailabilityBlock,
    DoctorAppointmentOut,
    DoctorProfileIn,
    DoctorProfileOut,
)
from app.security import require_role
from app.slots import to_minutes

# Everything here is about the logged-in doctor's own data
router = APIRouter(prefix="/api/doctor", tags=["doctor"])
current_doctor = require_role("doctor")


def check_blocks(blocks, slot_minutes):
    ordered = sorted(blocks, key=lambda block: (block.day_of_week, block.start_time))
    for index, block in enumerate(ordered):
        day = DAY_NAMES[block.day_of_week]
        if block.end_time <= block.start_time:
            raise HTTPException(
                status_code=400, detail=f"{day}: the end time must be after the start time"
            )
        if to_minutes(block.end_time) - to_minutes(block.start_time) < slot_minutes:
            raise HTTPException(
                status_code=400,
                detail=f"{day}: each block must be at least {slot_minutes} minutes long",
            )
        previous = ordered[index - 1] if index > 0 else None
        if previous and previous.day_of_week == block.day_of_week:
            if block.start_time < previous.end_time:
                raise HTTPException(status_code=400, detail=f"{day}: two time blocks overlap")


@router.get("/profile", response_model=DoctorProfileOut)
def read_profile(user: User = Depends(current_doctor)):
    if user.doctor_profile is None:
        raise HTTPException(status_code=404, detail="You have not set up your profile yet")
    return user.doctor_profile


@router.put("/profile", response_model=DoctorProfileOut)
def save_profile(
    data: DoctorProfileIn, user: User = Depends(current_doctor), db: Session = Depends(get_db)
):
    taken = db.scalar(
        select(DoctorProfile).where(
            DoctorProfile.pmdc_number == data.pmdc_number, DoctorProfile.user_id != user.id
        )
    )
    if taken:
        raise HTTPException(
            status_code=400, detail="This PMDC number is already registered with another account"
        )

    profile = user.doctor_profile
    if profile is None:
        profile = DoctorProfile(user=user)
        db.add(profile)

    for field, value in data.model_dump().items():
        setattr(profile, field, value)

    # A rejected doctor who fixes their details goes back into the admin queue
    if profile.approval_status == "rejected":
        profile.approval_status = "pending"
        profile.rejection_reason = None
        profile.submitted_at = datetime.now()

    db.commit()
    db.refresh(profile)
    return profile


@router.get("/availability", response_model=list[AvailabilityBlock])
def read_availability(user: User = Depends(current_doctor)):
    if user.doctor_profile is None:
        return []
    return user.doctor_profile.availability


@router.put("/availability", response_model=list[AvailabilityBlock])
def save_availability(
    blocks: list[AvailabilityBlock],
    user: User = Depends(current_doctor),
    db: Session = Depends(get_db),
):
    profile = user.doctor_profile
    if profile is None:
        raise HTTPException(status_code=400, detail="Please complete your profile first")
    if not blocks:
        raise HTTPException(status_code=400, detail="Please add at least one time block")

    check_blocks(blocks, profile.slot_minutes)

    # The whole week is replaced, and delete-orphan removes the old rows
    profile.availability = [Availability(**block.model_dump()) for block in blocks]
    db.commit()
    db.refresh(profile)
    return profile.availability


@router.get("/appointments", response_model=list[DoctorAppointmentOut])
def my_appointments(
    from_day: dt_date | None = Query(default=None, alias="from"),
    to_day: dt_date | None = Query(default=None, alias="to"),
    user: User = Depends(current_doctor),
    db: Session = Depends(get_db),
):
    if user.doctor_profile is None:
        return []
    # By default: the last week and the next two weeks, which covers everything the home page shows
    from_day = from_day or dt_date.today() - timedelta(days=7)
    to_day = to_day or dt_date.today() + timedelta(days=14)
    return db.scalars(
        select(Appointment)
        .where(
            Appointment.doctor_id == user.doctor_profile.id,
            Appointment.date >= from_day,
            Appointment.date <= to_day,
        )
        .order_by(Appointment.date, Appointment.start_time)
    ).all()


@router.patch("/appointments/{appointment_id}", response_model=DoctorAppointmentOut)
def update_appointment(
    appointment_id: int,
    data: AppointmentStatusIn,
    user: User = Depends(current_doctor),
    db: Session = Depends(get_db),
):
    appointment = db.get(Appointment, appointment_id)
    profile = user.doctor_profile
    if appointment is None or profile is None or appointment.doctor_id != profile.id:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if appointment.status != "confirmed":
        raise HTTPException(
            status_code=400, detail="Only confirmed appointments can be marked completed"
        )
    if datetime.combine(appointment.date, appointment.start_time) > datetime.now():
        raise HTTPException(
            status_code=400,
            detail="You can mark an appointment completed once its start time has passed",
        )

    appointment.status = data.status
    db.commit()
    db.refresh(appointment)
    return appointment
