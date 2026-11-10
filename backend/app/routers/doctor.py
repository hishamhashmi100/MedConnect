from datetime import date as dt_date
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import DAY_NAMES
from app.database import get_db
from app.models import Appointment, Availability, Clinic, DoctorProfile, User
from app.schemas import (
    AppointmentStatusIn,
    AvailabilityBlock,
    AvailabilitySaveOut,
    ClinicsIn,
    DoctorAppointmentOut,
    DoctorProfileIn,
    DoctorProfileOut,
    ReasonIn,
    ScheduleIn,
)
from app.security import require_role
from app.slots import block_length, blocks_at, fits_in_hours, segments_on

# Everything here is about the logged-in doctor's own data
router = APIRouter(prefix="/api/doctor", tags=["doctor"])
current_doctor = require_role("doctor")

# The admin checks these against the PMDC register, so changing one means a new review
REVIEWED_FIELDS = ("pmdc_number", "specialty")


def claim_pmdc(db, pmdc_number, user):
    """Stops two accounts from using one PMDC number. user is the one claiming it (or None)."""
    holder = db.scalar(select(DoctorProfile).where(DoctorProfile.pmdc_number == pmdc_number))
    if holder is None or (user is not None and holder.user_id == user.id):
        return
    if holder.user.is_verified:
        raise HTTPException(
            status_code=400, detail="This PMDC number is already registered with another account"
        )
    # A sign up that never verified its email can't block the real owner of the number
    db.delete(holder)
    db.flush()


def check_blocks(blocks, slot_minutes):
    for block in blocks:
        day = DAY_NAMES[block.day_of_week]
        if block.end_time == block.start_time:
            raise HTTPException(
                status_code=400, detail=f"{day}: the start and end times can't be the same"
            )
        if block_length(block) < slot_minutes:
            raise HTTPException(
                status_code=400,
                detail=f"{day}: each block must be at least {slot_minutes} minutes long",
            )
    # Checked per weekday after splitting overnight blocks, so Monday night is also compared
    # with Tuesday morning
    for weekday, day in enumerate(DAY_NAMES):
        parts = segments_on(blocks, weekday)
        for (_, previous_end), (start, _) in zip(parts, parts[1:]):
            if start < previous_end:
                raise HTTPException(status_code=400, detail=f"{day}: two time blocks overlap")


def upcoming_bookings(db, profile):
    now = datetime.now()
    rows = db.scalars(
        select(Appointment)
        .where(
            Appointment.doctor_id == profile.id,
            Appointment.status == "confirmed",
            Appointment.date >= now.date(),
        )
        .order_by(Appointment.date, Appointment.start_time)
    ).all()
    return [row for row in rows if datetime.combine(row.date, row.start_time) > now]


def find_own_appointment(db, appointment_id, user):
    appointment = db.get(Appointment, appointment_id)
    profile = user.doctor_profile
    # Another doctor's booking gets the same answer as a missing one
    if appointment is None or profile is None or appointment.doctor_id != profile.id:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appointment


@router.get("/profile", response_model=DoctorProfileOut)
def read_profile(user: User = Depends(current_doctor)):
    if user.doctor_profile is None:
        raise HTTPException(status_code=404, detail="You have not set up your profile yet")
    return user.doctor_profile


@router.put("/profile", response_model=DoctorProfileOut)
def save_profile(
    data: DoctorProfileIn, user: User = Depends(current_doctor), db: Session = Depends(get_db)
):
    claim_pmdc(db, data.pmdc_number, user)

    profile = user.doctor_profile
    if profile is None:
        profile = DoctorProfile(user=user)
        db.add(profile)

    reviewed_change = profile.approval_status == "approved" and any(
        getattr(profile, field) != getattr(data, field) for field in REVIEWED_FIELDS
    )

    for field, value in data.model_dump().items():
        setattr(profile, field, value)

    # A rejected doctor who fixes their details, or an approved one who changes what the
    # admin checked, goes back into the review queue and the old decision no longer applies
    if profile.approval_status == "rejected" or reviewed_change:
        profile.approval_status = "pending"
        profile.rejection_reason = None
        profile.reviewer = None
        profile.reviewed_at = None
        profile.submitted_at = datetime.now()

    db.commit()
    db.refresh(profile)
    return profile


@router.put("/clinics", response_model=DoctorProfileOut)
def save_clinics(
    data: ClinicsIn, user: User = Depends(current_doctor), db: Session = Depends(get_db)
):
    profile = user.doctor_profile
    if profile is None:
        raise HTTPException(status_code=400, detail="Please complete your profile first")

    own = {clinic.id: clinic for clinic in profile.clinics}
    kept_ids = {item.id for item in data.clinics if item.id is not None}
    if not kept_ids <= own.keys():
        raise HTTPException(status_code=404, detail="Clinic not found")

    # Patients who already booked must not lose the place they are going to
    upcoming = upcoming_bookings(db, profile)
    for clinic in profile.clinics:
        if clinic.id not in kept_ids and any(row.clinic_id == clinic.id for row in upcoming):
            raise HTTPException(
                status_code=400,
                detail=f"{clinic.name} has upcoming bookings. Cancel them from your home page "
                "before removing it",
            )
    if not data.offers_home_visit and any(row.consultation_type == "home" for row in upcoming):
        raise HTTPException(
            status_code=400,
            detail="You have upcoming home visits. Cancel them from your home page before "
            "turning home visits off",
        )

    # Weekly hours at a removed clinic go with it, and so do home visit hours when home
    # visits are turned off
    profile.availability = [
        block
        for block in profile.availability
        if block.clinic_id in kept_ids or (block.clinic_id is None and data.offers_home_visit)
    ]

    clinics = []
    for item in data.clinics:
        clinic = own.get(item.id) or Clinic()
        clinic.name = item.name
        clinic.area = item.area
        clinic.address = item.address
        clinic.fee = item.fee
        clinics.append(clinic)
    # Clinics left out of the list are deleted by delete-orphan
    profile.clinics = clinics
    profile.offers_home_visit = data.offers_home_visit
    profile.home_visit_fee = data.home_visit_fee

    db.commit()
    db.refresh(profile)
    return profile


@router.get("/availability", response_model=list[AvailabilityBlock])
def read_availability(user: User = Depends(current_doctor)):
    if user.doctor_profile is None:
        return []
    return user.doctor_profile.availability


@router.put("/availability", response_model=AvailabilitySaveOut)
def save_availability(
    data: ScheduleIn,
    user: User = Depends(current_doctor),
    db: Session = Depends(get_db),
):
    profile = user.doctor_profile
    if profile is None:
        raise HTTPException(status_code=400, detail="Please complete your profile first")
    if not profile.clinics and not profile.offers_home_visit:
        raise HTTPException(
            status_code=400, detail="Please add a clinic or turn on home visits first"
        )
    if not data.blocks:
        raise HTTPException(status_code=400, detail="Please add at least one time block")

    clinic_ids = {clinic.id for clinic in profile.clinics}
    for block in data.blocks:
        if block.clinic_id is None and not profile.offers_home_visit:
            raise HTTPException(
                status_code=400,
                detail="Home visits are turned off. Please choose one of your clinics",
            )
        if block.clinic_id is not None and block.clinic_id not in clinic_ids:
            raise HTTPException(status_code=400, detail="Please choose one of your clinics")

    # Blocks at different places can't overlap either, since the doctor can't be in two places
    check_blocks(data.blocks, data.slot_minutes)

    # Bookings already made keep their own start and end times, so a new appointment
    # length only changes the slots offered from now on
    profile.slot_minutes = data.slot_minutes
    # The whole week is replaced, and delete-orphan removes the old rows
    profile.availability = [Availability(**block.model_dump()) for block in data.blocks]
    db.commit()
    db.refresh(profile)

    # Bookings made under the old hours are kept; the doctor decides whether to cancel them
    outside = [
        row
        for row in upcoming_bookings(db, profile)
        if not fits_in_hours(
            row.date, row.start_time, row.end_time, blocks_at(profile.availability, row.clinic_id)
        )
    ]
    return {"blocks": profile.availability, "outside_hours": outside}


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
    appointment = find_own_appointment(db, appointment_id, user)
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


@router.patch("/appointments/{appointment_id}/cancel", response_model=DoctorAppointmentOut)
def cancel_appointment(
    appointment_id: int,
    data: ReasonIn,
    user: User = Depends(current_doctor),
    db: Session = Depends(get_db),
):
    appointment = find_own_appointment(db, appointment_id, user)
    starts_at = datetime.combine(appointment.date, appointment.start_time)
    if appointment.status != "confirmed" or starts_at <= datetime.now():
        raise HTTPException(
            status_code=400, detail="Only upcoming confirmed appointments can be cancelled"
        )

    # The patient sees the reason on their appointments page
    appointment.status = "cancelled"
    appointment.cancelled_by = "doctor"
    appointment.cancel_reason = data.reason
    db.commit()
    db.refresh(appointment)
    return appointment
