"""Fills the database with demo data.

Run from the backend folder:
    python seed.py           adds the demo data if it isn't there yet
    python seed.py --reset   drops every table first, then adds the demo data
"""

import argparse
from collections import defaultdict
from datetime import date, datetime, time, timedelta

from sqlalchemy import select

from app.constants import DEMO_PATIENT_EMAIL
from app.database import Base, SessionLocal, engine
from app.models import Appointment, Availability, DoctorProfile, User
from app.security import hash_password
from app.slots import BOOKING_WINDOW_DAYS, add_minutes, day_slots, open_slots

# Every demo account uses the same password so they are easy to try out
DEMO_PASSWORD = "demo1234"
ADMIN_EMAIL = "admin@example.com"

MON_TO_FRI = [0, 1, 2, 3, 4]
MON_TO_SAT = [0, 1, 2, 3, 4, 5]

# hours is a list of (weekdays, start, end) blocks
DOCTORS = [
    {
        "name": "Ayesha Siddiqui",
        "email": "ayesha.siddiqui@example.com",
        "specialty": "Cardiologist",
        "pmdc": "12345-P",
        "experience": 12,
        "area": "Clifton",
        "clinic": "Plot 21, Block 4, Clifton, Karachi",
        "fee": 2500,
        "home_visits": True,
        "hours": [(MON_TO_SAT, "10:00", "13:00"), (MON_TO_FRI, "17:00", "21:00")],
    },
    {
        "name": "Bilal Ahmed",
        "email": "bilal.ahmed@example.com",
        "specialty": "General Physician",
        "pmdc": "78421-S",
        "experience": 9,
        "area": "Gulshan-e-Iqbal",
        "clinic": "Shop 3, Block 13-D, Gulshan-e-Iqbal, Karachi",
        "fee": 1800,
        "home_visits": True,
        "hours": [(MON_TO_SAT, "09:00", "14:00"), ([6], "11:00", "15:00")],
    },
    {
        "name": "Fatima Khan",
        "email": "fatima.khan@example.com",
        "specialty": "Dermatologist",
        "pmdc": "45120-P",
        "experience": 7,
        "area": "DHA Phase 6",
        "clinic": "Khayaban-e-Ittehad, Phase 6, DHA, Karachi",
        "fee": 3000,
        "home_visits": False,
        "hours": [(MON_TO_FRI, "16:00", "20:00")],
    },
    {
        "name": "Usman Qureshi",
        "email": "usman.qureshi@example.com",
        "specialty": "Pediatrician",
        "pmdc": "30987-P",
        "experience": 15,
        "area": "North Nazimabad",
        "clinic": "Block H, North Nazimabad, Karachi",
        "fee": 2000,
        "home_visits": True,
        "hours": [(MON_TO_SAT, "10:00", "14:00"), ([0, 2, 4], "18:00", "21:00")],
    },
    {
        "name": "Sana Malik",
        "email": "sana.malik@example.com",
        "specialty": "Gynecologist",
        "pmdc": "51234-P",
        "experience": 11,
        "area": "PECHS",
        "clinic": "Block 2, PECHS, Karachi",
        "fee": 3500,
        "home_visits": False,
        "hours": [(MON_TO_FRI, "11:00", "15:00")],
    },
    {
        "name": "Hamza Sheikh",
        "email": "hamza.sheikh@example.com",
        "specialty": "Orthopedic Surgeon",
        "pmdc": "60412-P",
        "experience": 14,
        "area": "Clifton",
        "clinic": "Block 5, Clifton, Karachi",
        "fee": 3500,
        "home_visits": False,
        "hours": [([1, 3, 5], "17:00", "21:00")],
    },
    {
        "name": "Kamran Yousuf",
        "email": "kamran.yousuf@example.com",
        "specialty": "ENT Specialist",
        "pmdc": "27765-S",
        "experience": 10,
        "area": "Gulshan-e-Iqbal",
        "clinic": "Block 10-A, Gulshan-e-Iqbal, Karachi",
        "fee": 2200,
        "home_visits": False,
        "hours": [(MON_TO_SAT, "17:00", "20:00")],
    },
    {
        "name": "Nadia Hussain",
        "email": "nadia.hussain@example.com",
        "specialty": "Psychiatrist",
        "pmdc": "48890-P",
        "experience": 8,
        "area": "DHA Phase 2",
        "clinic": "Phase 2 Extension, DHA, Karachi",
        "fee": 3000,
        "home_visits": True,
        "hours": [(MON_TO_FRI, "12:00", "16:00")],
    },
    {
        "name": "Faisal Memon",
        "email": "faisal.memon@example.com",
        "specialty": "Gastroenterologist",
        "pmdc": "39021-P",
        "experience": 13,
        "area": "PECHS",
        "clinic": "Block 6, PECHS, Karachi",
        "fee": 2800,
        "home_visits": False,
        "hours": [([0, 2, 4], "10:00", "13:00"), ([1, 3], "17:00", "20:00")],
    },
    {
        "name": "Hira Baig",
        "email": "hira.baig@example.com",
        "specialty": "Eye Specialist",
        "pmdc": "55673-P",
        "experience": 6,
        "area": "North Nazimabad",
        "clinic": "Block L, North Nazimabad, Karachi",
        "fee": 1500,
        "home_visits": False,
        "hours": [(MON_TO_SAT, "09:00", "13:00")],
    },
]

# Waiting in the admin queue, so the approval flow can be shown
PENDING_DOCTOR = {
    "name": "Mariam Akhtar",
    "email": "mariam.akhtar@example.com",
    "specialty": "Neurologist",
    "pmdc": "33482-P",
    "experience": 9,
    "area": "DHA Phase 5",
    "clinic": "Phase 5, DHA, Karachi",
    "fee": 3000,
    "home_visits": False,
    "hours": [(MON_TO_FRI, "15:00", "19:00")],
}


def add_user(db, full_name, email, role):
    user = User(
        full_name=full_name,
        email=email,
        password_hash=hash_password(DEMO_PASSWORD),
        role=role,
        is_verified=True,
    )
    db.add(user)
    return user


def add_doctor(db, data, status, submitted_days_ago):
    user = add_user(db, data["name"], data["email"], "doctor")
    profile = DoctorProfile(
        user=user,
        specialty=data["specialty"],
        pmdc_number=data["pmdc"],
        experience_years=data["experience"],
        city="Karachi",
        area=data["area"],
        clinic_address=data["clinic"],
        fee=data["fee"],
        offers_clinic=True,
        offers_home_visit=data["home_visits"],
        slot_minutes=30,
        approval_status=status,
        submitted_at=datetime.now() - timedelta(days=submitted_days_ago),
    )
    profile.availability = [
        Availability(
            day_of_week=day,
            start_time=time.fromisoformat(start),
            end_time=time.fromisoformat(end),
        )
        for days, start, end in data["hours"]
        for day in days
    ]
    db.add(profile)
    return profile


class Booker:
    """Places demo appointments on real open slots, starting from a given day."""

    def __init__(self, db):
        self.db = db
        self.taken = defaultdict(list)

    def upcoming(self, patient, doctor, days_from_today, **details):
        now = datetime.now()
        for offset in range(days_from_today, BOOKING_WINDOW_DAYS):
            day = now.date() + timedelta(days=offset)
            slots = open_slots(
                day, doctor.availability, doctor.slot_minutes, self.taken[doctor, day], now
            )
            if slots:
                self.add(patient, doctor, day, slots[0], "confirmed", **details)
                return

    def past(self, patient, doctor, days_ago, **details):
        day = date.today() - timedelta(days=days_ago)
        while not day_slots(self.blocks_on(doctor, day), doctor.slot_minutes):
            day -= timedelta(days=1)
        start = day_slots(self.blocks_on(doctor, day), doctor.slot_minutes)[0]
        self.add(patient, doctor, day, start, "completed", **details)

    def blocks_on(self, doctor, day):
        return [block for block in doctor.availability if block.day_of_week == day.weekday()]

    def add(self, patient, doctor, day, start, status, consultation_type="clinic", **details):
        end = add_minutes(start, doctor.slot_minutes)
        self.taken[doctor, day].append((start, end))
        self.db.add(
            Appointment(
                patient=patient,
                doctor=doctor,
                date=day,
                start_time=start,
                end_time=end,
                consultation_type=consultation_type,
                status=status,
                **details,
            )
        )


def main():
    parser = argparse.ArgumentParser(description="Fill the database with demo data")
    parser.add_argument("--reset", action="store_true", help="drop and recreate all tables first")
    args = parser.parse_args()

    if args.reset:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        if db.scalar(select(User).where(User.email == ADMIN_EMAIL)):
            print("Demo data is already there. Run with --reset to start again.")
            return

        add_user(db, "Admin Team", ADMIN_EMAIL, "admin")
        doctors = [
            add_doctor(db, data, "approved", submitted_days_ago=20 - index)
            for index, data in enumerate(DOCTORS)
        ]
        add_doctor(db, PENDING_DOCTOR, "pending", submitted_days_ago=1)

        ahmed = add_user(db, "Ahmed Raza", DEMO_PATIENT_EMAIL, "patient")
        sara = add_user(db, "Sara Khan", "sara.khan@example.com", "patient")
        farhan = add_user(db, "Farhan Ali", "farhan.ali@example.com", "patient")

        ayesha, bilal, hira = doctors[0], doctors[1], doctors[9]
        booker = Booker(db)
        booker.upcoming(ahmed, ayesha, 1, patient_note="Follow-up on blood pressure readings")
        booker.upcoming(
            ahmed,
            bilal,
            3,
            consultation_type="home",
            home_address="House 12, Street 4, Block 7, Gulshan-e-Iqbal, Karachi",
            patient_note="Fever and body ache for two days",
        )
        booker.past(ahmed, hira, 10, patient_note="Eye check-up")
        booker.upcoming(sara, ayesha, 0)
        booker.upcoming(
            farhan,
            ayesha,
            2,
            consultation_type="home",
            home_address="Flat 5, Sea View Apartments, Clifton, Karachi",
        )
        booker.past(sara, ayesha, 3)

        db.commit()

    print("Demo data added. Every demo account uses the password:", DEMO_PASSWORD)
    print("  Patient:         ", DEMO_PATIENT_EMAIL)
    print("  Doctor:          ", DOCTORS[0]["email"])
    print("  Pending doctor:  ", PENDING_DOCTOR["email"])
    print("  Admin:           ", ADMIN_EMAIL)


if __name__ == "__main__":
    main()
