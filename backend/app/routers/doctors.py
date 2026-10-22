import re
from collections import defaultdict
from datetime import date as dt_date
from datetime import datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.constants import SYMPTOMS
from app.database import get_db
from app.models import Appointment, DoctorProfile, User
from app.schemas import DaySlotsOut, DoctorCardOut
from app.slots import NEXT_SLOT_DAYS, is_bookable_date, next_open_slot, open_slots

# Public doctor directory used by patients
router = APIRouter(prefix="/api/doctors", tags=["doctors"])


def booked_times(db, doctor_ids, first_day, last_day):
    """Taken (start, end) times as {doctor_id: {date: [...]}}, ignoring cancelled bookings."""
    rows = db.execute(
        select(
            Appointment.doctor_id, Appointment.date, Appointment.start_time, Appointment.end_time
        ).where(
            Appointment.doctor_id.in_(doctor_ids),
            Appointment.date >= first_day,
            Appointment.date <= last_day,
            Appointment.status != "cancelled",
        )
    ).all()
    booked = defaultdict(lambda: defaultdict(list))
    for row in rows:
        booked[row.doctor_id][row.date].append((row.start_time, row.end_time))
    return booked


def doctor_cards(db, profiles):
    now = datetime.now()
    booked = booked_times(
        db,
        [profile.id for profile in profiles],
        now.date(),
        now.date() + timedelta(days=NEXT_SLOT_DAYS),
    )
    return [
        DoctorCardOut(
            id=profile.id,
            full_name=profile.full_name,
            specialty=profile.specialty,
            pmdc_number=profile.pmdc_number,
            experience_years=profile.experience_years,
            city=profile.city,
            area=profile.area,
            clinic_address=profile.clinic_address,
            fee=profile.fee,
            offers_clinic=profile.offers_clinic,
            offers_home_visit=profile.offers_home_visit,
            slot_minutes=profile.slot_minutes,
            next_open_slot=next_open_slot(
                profile.availability, profile.slot_minutes, booked[profile.id], now
            ),
            available_days=sorted({block.day_of_week for block in profile.availability}),
        )
        for profile in profiles
    ]


def bookable_doctors():
    # Patients only ever see approved doctors who have set some weekly hours
    return (
        select(DoctorProfile)
        .join(DoctorProfile.user)
        .where(DoctorProfile.approval_status == "approved", DoctorProfile.availability.any())
    )


@router.get("", response_model=list[DoctorCardOut])
def search_doctors(
    specialty: str | None = None,
    symptom: str | None = None,
    consultation_type: Literal["clinic", "home"] | None = None,
    city: str | None = None,
    q: str | None = None,
    sort: Literal["earliest", "fee_low", "fee_high", "experience"] = "earliest",
    db: Session = Depends(get_db),
):
    query = bookable_doctors()
    if specialty:
        query = query.where(DoctorProfile.specialty == specialty)
    if symptom:
        if symptom not in SYMPTOMS:
            raise HTTPException(status_code=400, detail="Please choose a symptom from the list")
        query = query.where(DoctorProfile.specialty == SYMPTOMS[symptom])
    if consultation_type == "clinic":
        query = query.where(DoctorProfile.offers_clinic.is_(True))
    if consultation_type == "home":
        query = query.where(DoctorProfile.offers_home_visit.is_(True))
    if city:
        query = query.where(DoctorProfile.city == city)
    if q:
        # "Dr. Ayesha" should still find Ayesha, since names are stored without the title
        text = re.sub(r"^dr\.?\s*", "", q.strip(), flags=re.IGNORECASE)
        pattern = f"%{text}%"
        query = query.where(
            or_(User.full_name.ilike(pattern), DoctorProfile.specialty.ilike(pattern))
        )

    # Sorting by name first means equal fees or slots always come out in the same order
    cards = doctor_cards(db, db.scalars(query.order_by(User.full_name)).all())

    if sort == "earliest":
        # Doctors with no open slot this week go to the end
        cards.sort(key=lambda card: card.next_open_slot or datetime.max)
    elif sort == "fee_low":
        cards.sort(key=lambda card: card.fee)
    elif sort == "fee_high":
        cards.sort(key=lambda card: card.fee, reverse=True)
    else:
        cards.sort(key=lambda card: card.experience_years, reverse=True)
    return cards


def find_bookable_doctor(db, doctor_id):
    profile = db.scalar(bookable_doctors().where(DoctorProfile.id == doctor_id))
    if profile is None:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return profile


@router.get("/{doctor_id}", response_model=DoctorCardOut)
def read_doctor(doctor_id: int, db: Session = Depends(get_db)):
    return doctor_cards(db, [find_bookable_doctor(db, doctor_id)])[0]


@router.get("/{doctor_id}/slots", response_model=DaySlotsOut)
def read_day_slots(
    doctor_id: int, day: dt_date = Query(alias="date"), db: Session = Depends(get_db)
):
    profile = find_bookable_doctor(db, doctor_id)
    now = datetime.now()
    if not is_bookable_date(day, now.date()):
        raise HTTPException(status_code=400, detail="You can book from today up to 14 days ahead")

    booked = booked_times(db, [profile.id], day, day)[profile.id][day]
    slots = open_slots(day, profile.availability, profile.slot_minutes, booked, now)
    return {"date": day, "slots": slots}
