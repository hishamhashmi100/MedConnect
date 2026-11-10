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
from app.models import Appointment, Availability, Clinic, DoctorProfile, User
from app.security import hash_password
from app.slots import BOOKING_WINDOW_DAYS, add_minutes, blocks_at, day_slots, open_slots

# Every demo account uses the same password so they are easy to try out
DEMO_PASSWORD = "demo1234"
ADMIN_EMAIL = "admin@example.com"

MON_TO_FRI = [0, 1, 2, 3, 4]
MON_TO_SAT = [0, 1, 2, 3, 4, 5]
# Marks hours and bookings that are home visits rather than at a clinic
HOME = "home"

# clinics is a list of (name, area, address, fee). home_fee is None for doctors who don't
# do home visits. hours is a list of (weekdays, start, end, place), where place is the
# index of a clinic in the list, or HOME.
DOCTORS = [
    {
        "name": "Ayesha Siddiqui",
        "email": "ayesha.siddiqui@example.com",
        "specialty": "Cardiologist",
        "pmdc": "12345-P",
        "experience": 12,
        "clinics": [
            ("Clifton Heart Centre", "Clifton", "Plot 21, Block 4, Clifton, Karachi", 2500),
            (
                "Seaview Medical Complex",
                "DHA Phase 5",
                "Khayaban-e-Shahbaz, Phase 5, DHA, Karachi",
                3500,
            ),
        ],
        "home_fee": 4000,
        "hours": [
            (MON_TO_SAT, "10:00", "13:00", 0),
            (MON_TO_FRI, "17:00", "20:00", 1),
            ([5, 6], "15:00", "18:00", HOME),
        ],
    },
    {
        "name": "Bilal Ahmed",
        "email": "bilal.ahmed@example.com",
        "specialty": "General Physician",
        "pmdc": "78421-S",
        "experience": 9,
        "clinics": [
            (
                "Gulshan Family Clinic",
                "Gulshan-e-Iqbal",
                "Shop 3, Block 13-D, Gulshan-e-Iqbal, Karachi",
                1800,
            ),
        ],
        "home_fee": 2500,
        "hours": [
            (MON_TO_SAT, "09:00", "14:00", 0),
            (MON_TO_FRI, "18:00", "20:00", HOME),
            ([6], "11:00", "15:00", HOME),
        ],
    },
    {
        "name": "Fatima Khan",
        "email": "fatima.khan@example.com",
        "specialty": "Dermatologist",
        "pmdc": "45120-P",
        "experience": 7,
        "clinics": [
            (
                "Skin and Laser Clinic",
                "DHA Phase 6",
                "Khayaban-e-Ittehad, Phase 6, DHA, Karachi",
                3000,
            ),
        ],
        "home_fee": None,
        "hours": [(MON_TO_FRI, "16:00", "20:00", 0)],
    },
    {
        "name": "Usman Qureshi",
        "email": "usman.qureshi@example.com",
        "specialty": "Pediatrician",
        "pmdc": "30987-P",
        "experience": 15,
        "clinics": [
            (
                "Nazimabad Children's Clinic",
                "North Nazimabad",
                "Block H, North Nazimabad, Karachi",
                2000,
            ),
            ("Gulberg Medical Centre", "Gulberg", "Block 9, Gulberg Town, Karachi", 2500),
        ],
        "home_fee": 3000,
        "hours": [
            (MON_TO_SAT, "10:00", "14:00", 0),
            ([0, 2, 4], "18:00", "21:00", 1),
            ([1, 3], "18:00", "20:00", HOME),
        ],
    },
    {
        "name": "Sana Malik",
        "email": "sana.malik@example.com",
        "specialty": "Gynecologist",
        "pmdc": "51234-P",
        "experience": 11,
        "clinics": [
            ("PECHS Women's Health Clinic", "PECHS", "Block 2, PECHS, Karachi", 3500),
        ],
        "home_fee": None,
        "hours": [(MON_TO_FRI, "11:00", "15:00", 0)],
    },
    {
        "name": "Hamza Sheikh",
        "email": "hamza.sheikh@example.com",
        "specialty": "Orthopedic Surgeon",
        "pmdc": "60412-P",
        "experience": 14,
        "clinics": [
            ("Clifton Bone and Joint Clinic", "Clifton", "Block 5, Clifton, Karachi", 3500),
            (
                "Karsaz Surgical Centre",
                "Karsaz",
                "Shahrah-e-Faisal, near Karsaz, Karachi",
                3000,
            ),
        ],
        "home_fee": None,
        "hours": [([1, 3, 5], "17:00", "21:00", 0), ([0, 2], "10:00", "13:00", 1)],
    },
    {
        "name": "Kamran Yousuf",
        "email": "kamran.yousuf@example.com",
        "specialty": "ENT Specialist",
        "pmdc": "27765-S",
        "experience": 10,
        "clinics": [
            (
                "Gulshan ENT Clinic",
                "Gulshan-e-Iqbal",
                "Block 10-A, Gulshan-e-Iqbal, Karachi",
                2200,
            ),
        ],
        "home_fee": None,
        "hours": [(MON_TO_SAT, "17:00", "20:00", 0)],
    },
    {
        "name": "Nadia Hussain",
        "email": "nadia.hussain@example.com",
        "specialty": "Psychiatrist",
        "pmdc": "48890-P",
        "experience": 8,
        "clinics": [
            ("Mind Care Clinic", "DHA Phase 2", "Phase 2 Extension, DHA, Karachi", 3000),
        ],
        "home_fee": 3500,
        "hours": [(MON_TO_FRI, "12:00", "16:00", 0), ([5], "11:00", "14:00", HOME)],
    },
    {
        "name": "Faisal Memon",
        "email": "faisal.memon@example.com",
        "specialty": "Gastroenterologist",
        "pmdc": "39021-P",
        "experience": 13,
        "clinics": [
            ("PECHS Digestive Clinic", "PECHS", "Block 6, PECHS, Karachi", 2800),
            ("Saddar Medical Centre", "Saddar", "Abdullah Haroon Road, Saddar, Karachi", 2000),
        ],
        "home_fee": None,
        "hours": [([0, 2, 4], "10:00", "13:00", 0), ([1, 3], "17:00", "20:00", 1)],
    },
    {
        "name": "Hira Baig",
        "email": "hira.baig@example.com",
        "specialty": "Eye Specialist",
        "pmdc": "55673-P",
        "experience": 6,
        "clinics": [
            (
                "Nazimabad Eye Clinic",
                "North Nazimabad",
                "Block L, North Nazimabad, Karachi",
                1500,
            ),
        ],
        "home_fee": None,
        "hours": [(MON_TO_SAT, "09:00", "13:00", 0)],
    },
    {
        "name": "Tariq Mehmood",
        "email": "tariq.mehmood@example.com",
        "specialty": "Neurologist",
        "pmdc": "41876-P",
        "experience": 16,
        "clinics": [
            (
                "Karachi Neuro Centre",
                "Gulshan-e-Iqbal",
                "Block 7, Gulshan-e-Iqbal, Karachi",
                3500,
            ),
        ],
        "home_fee": None,
        "hours": [(MON_TO_FRI, "16:00", "20:00", 0), ([5], "10:00", "13:00", 0)],
    },
    {
        "name": "Zainab Farooq",
        "email": "zainab.farooq@example.com",
        "specialty": "Dentist",
        "pmdc": "62309-P",
        "experience": 7,
        "clinics": [
            (
                "Smile Dental Clinic",
                "Bahadurabad",
                "Shop 5, near Bahadurabad Chowrangi, Karachi",
                1500,
            ),
            ("Clifton Dental Studio", "Clifton", "Block 8, Clifton, Karachi", 2000),
        ],
        "home_fee": None,
        "hours": [(MON_TO_SAT, "10:00", "14:00", 0), ([0, 2, 4], "17:00", "20:00", 1)],
    },
]

# Waiting in the admin queue, so the approval flow can be shown
PENDING_DOCTOR = {
    "name": "Mariam Akhtar",
    "email": "mariam.akhtar@example.com",
    "specialty": "Neurologist",
    "pmdc": "33482-P",
    "experience": 9,
    "clinics": [("DHA Neuro Clinic", "DHA Phase 5", "Phase 5, DHA, Karachi", 3000)],
    "home_fee": None,
    "hours": [(MON_TO_FRI, "15:00", "19:00", 0)],
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


def add_doctor(db, data, status, submitted_days_ago, reviewer=None):
    user = add_user(db, data["name"], data["email"], "doctor")
    submitted_at = datetime.now() - timedelta(days=submitted_days_ago)
    profile = DoctorProfile(
        user=user,
        specialty=data["specialty"],
        pmdc_number=data["pmdc"],
        experience_years=data["experience"],
        city="Karachi",
        offers_home_visit=data["home_fee"] is not None,
        home_visit_fee=data["home_fee"],
        slot_minutes=30,
        approval_status=status,
        submitted_at=submitted_at,
        # Reviewed doctors were checked by the admin the day after they applied
        reviewer=reviewer,
        reviewed_at=submitted_at + timedelta(days=1) if reviewer else None,
    )
    profile.clinics = [
        Clinic(name=name, area=area, address=address, fee=fee)
        for name, area, address, fee in data["clinics"]
    ]
    profile.availability = [
        Availability(
            clinic=None if place == HOME else profile.clinics[place],
            day_of_week=day,
            start_time=time.fromisoformat(start),
            end_time=time.fromisoformat(end),
        )
        for days, start, end, place in data["hours"]
        for day in days
    ]
    db.add(profile)
    return profile


class Booker:
    """Places demo appointments on real open slots, starting from a given day.

    place is the index of one of the doctor's clinics, or HOME for a home visit.
    """

    def __init__(self, db):
        self.db = db
        self.taken = defaultdict(list)

    def upcoming(self, patient, doctor, days_from_today, place=0, **details):
        now = datetime.now()
        blocks = self.blocks_for(doctor, place)
        for offset in range(days_from_today, BOOKING_WINDOW_DAYS):
            day = now.date() + timedelta(days=offset)
            slots = open_slots(day, blocks, doctor.slot_minutes, self.taken[doctor, day], now)
            if slots:
                self.add(patient, doctor, place, day, slots[0], "confirmed", **details)
                return

    def past(self, patient, doctor, days_ago, place=0, **details):
        blocks = self.blocks_for(doctor, place)
        day = date.today() - timedelta(days=days_ago)
        while not day_slots(blocks, day.weekday(), doctor.slot_minutes):
            day -= timedelta(days=1)
        start = day_slots(blocks, day.weekday(), doctor.slot_minutes)[0]
        self.add(patient, doctor, place, day, start, "completed", **details)

    def blocks_for(self, doctor, place):
        return blocks_at(doctor.availability, None if place == HOME else doctor.clinics[place].id)

    def add(self, patient, doctor, place, day, start, status, **details):
        clinic = None if place == HOME else doctor.clinics[place]
        end = add_minutes(start, doctor.slot_minutes)
        self.taken[doctor, day].append((start, end))
        self.db.add(
            Appointment(
                patient=patient,
                doctor=doctor,
                clinic=clinic,
                fee=clinic.fee if clinic else doctor.home_visit_fee,
                date=day,
                start_time=start,
                end_time=end,
                consultation_type="clinic" if clinic else "home",
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

        admin = add_user(db, "Admin Team", ADMIN_EMAIL, "admin")
        doctors = [
            add_doctor(db, data, "approved", submitted_days_ago=20 - index, reviewer=admin)
            for index, data in enumerate(DOCTORS)
        ]
        add_doctor(db, PENDING_DOCTOR, "pending", submitted_days_ago=1)
        # Gives the clinics their ids, which the weekly blocks are matched on below
        db.flush()

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
            place=HOME,
            home_address="House 12, Street 4, Block 7, Gulshan-e-Iqbal, Karachi",
            patient_note="Fever and body ache for two days",
        )
        booker.past(ahmed, hira, 10, patient_note="Eye check-up")
        booker.upcoming(sara, ayesha, 0)
        booker.upcoming(
            farhan,
            ayesha,
            2,
            place=HOME,
            home_address="Flat 5, Sea View Apartments, Clifton, Karachi",
        )
        booker.past(sara, ayesha, 3)
        booker.upcoming(sara, ayesha, 1, place=1, patient_note="Second opinion on an ECG report")

        db.commit()

    print("Demo data added. Every demo account uses the password:", DEMO_PASSWORD)
    print("  Patient:         ", DEMO_PATIENT_EMAIL)
    print("  Doctor:          ", DOCTORS[0]["email"])
    print("  Pending doctor:  ", PENDING_DOCTOR["email"])
    print("  Admin:           ", ADMIN_EMAIL)


if __name__ == "__main__":
    main()
