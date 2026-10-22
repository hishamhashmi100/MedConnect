from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Appointment, User
from app.routers.doctors import find_bookable_doctor
from app.schemas import AppointmentOut, BookingIn, RescheduleIn
from app.security import require_role
from app.slots import add_minutes, day_slots, is_bookable_date, open_slots

# A patient's own bookings. The patient always comes from the token, never from the request body.
router = APIRouter(prefix="/api/appointments", tags=["appointments"])
current_patient = require_role("patient")

SLOT_TAKEN = "This slot was just booked, please pick another"


def taken_times(db, doctor_id, day, skip_id=None):
    query = select(Appointment).where(
        Appointment.doctor_id == doctor_id,
        Appointment.date == day,
        Appointment.status != "cancelled",
    )
    # When rescheduling, the appointment being moved shouldn't block its own new time
    if skip_id is not None:
        query = query.where(Appointment.id != skip_id)
    return [(row.start_time, row.end_time) for row in db.scalars(query)]


def check_slot_open(db, profile, day, start_time, skip_id=None):
    now = datetime.now()
    if not is_bookable_date(day, now.date()):
        raise HTTPException(status_code=400, detail="You can book from today up to 14 days ahead")

    booked = taken_times(db, profile.id, day, skip_id)
    if start_time in open_slots(day, profile.availability, profile.slot_minutes, booked, now):
        return

    # Tell apart "someone else got it first" from "this was never a valid time"
    blocks = [block for block in profile.availability if block.day_of_week == day.weekday()]
    is_future = datetime.combine(day, start_time) > now
    if start_time in day_slots(blocks, profile.slot_minutes) and is_future:
        raise HTTPException(status_code=409, detail=SLOT_TAKEN)
    raise HTTPException(
        status_code=400, detail="This time is not available. Please pick another slot"
    )


def save_or_conflict(db):
    # Two people can pass the open-slot check at the same moment; the unique index stops the second
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=SLOT_TAKEN)


def find_own_upcoming(db, appointment_id, user):
    appointment = db.get(Appointment, appointment_id)
    if appointment is None or appointment.patient_id != user.id:
        raise HTTPException(status_code=404, detail="Appointment not found")
    starts_at = datetime.combine(appointment.date, appointment.start_time)
    if appointment.status != "confirmed" or starts_at <= datetime.now():
        raise HTTPException(
            status_code=400, detail="Only upcoming confirmed appointments can be changed"
        )
    return appointment


@router.post("", status_code=201, response_model=AppointmentOut)
def book_appointment(
    data: BookingIn, user: User = Depends(current_patient), db: Session = Depends(get_db)
):
    profile = find_bookable_doctor(db, data.doctor_id)

    if data.consultation_type == "clinic" and not profile.offers_clinic:
        raise HTTPException(status_code=400, detail="This doctor does not offer in-clinic visits")
    if data.consultation_type == "home":
        if not profile.offers_home_visit:
            raise HTTPException(status_code=400, detail="This doctor does not offer home visits")
        if not data.home_address or len(data.home_address) < 10:
            raise HTTPException(
                status_code=400, detail="Please enter the full address for the home visit"
            )

    check_slot_open(db, profile, data.date, data.start_time)

    appointment = Appointment(
        patient_id=user.id,
        doctor_id=profile.id,
        date=data.date,
        start_time=data.start_time,
        end_time=add_minutes(data.start_time, profile.slot_minutes),
        consultation_type=data.consultation_type,
        home_address=data.home_address if data.consultation_type == "home" else None,
        patient_note=data.patient_note or None,
    )
    db.add(appointment)
    save_or_conflict(db)
    db.refresh(appointment)
    return appointment


@router.get("/mine", response_model=list[AppointmentOut])
def my_appointments(user: User = Depends(current_patient), db: Session = Depends(get_db)):
    return db.scalars(
        select(Appointment)
        .where(Appointment.patient_id == user.id)
        .order_by(Appointment.date, Appointment.start_time)
    ).all()


@router.patch("/{appointment_id}/reschedule", response_model=AppointmentOut)
def reschedule_appointment(
    appointment_id: int,
    data: RescheduleIn,
    user: User = Depends(current_patient),
    db: Session = Depends(get_db),
):
    appointment = find_own_upcoming(db, appointment_id, user)
    profile = find_bookable_doctor(db, appointment.doctor_id)
    check_slot_open(db, profile, data.date, data.start_time, skip_id=appointment.id)

    appointment.date = data.date
    appointment.start_time = data.start_time
    appointment.end_time = add_minutes(data.start_time, profile.slot_minutes)
    save_or_conflict(db)
    db.refresh(appointment)
    return appointment


@router.patch("/{appointment_id}/cancel", response_model=AppointmentOut)
def cancel_appointment(
    appointment_id: int, user: User = Depends(current_patient), db: Session = Depends(get_db)
):
    appointment = find_own_upcoming(db, appointment_id, user)
    appointment.status = "cancelled"
    db.commit()
    db.refresh(appointment)
    return appointment
