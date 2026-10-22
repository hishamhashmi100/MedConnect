from datetime import date, time, timedelta

import pytest
from sqlalchemy.exc import IntegrityError

from app.models import Appointment, Availability, DoctorProfile, User
from app.security import create_token, hash_password

TOMORROW = date.today() + timedelta(days=1)


def add_user(db, email, role):
    user = User(
        full_name="Test User",
        email=email,
        password_hash=hash_password("secret123"),
        role=role,
        is_verified=True,
    )
    db.add(user)
    return user


def add_doctor(db):
    profile = DoctorProfile(
        user=add_user(db, "doctor@example.com", "doctor"),
        specialty="Cardiologist",
        pmdc_number="12345-P",
        experience_years=5,
        city="Karachi",
        area="Clifton",
        clinic_address="Block 4, Clifton, Karachi",
        fee=2000,
        offers_clinic=True,
        offers_home_visit=False,
        approval_status="approved",
    )
    # Working every day keeps the test independent of which weekday it runs on
    profile.availability = [
        Availability(day_of_week=day, start_time=time(9, 0), end_time=time(12, 0))
        for day in range(7)
    ]
    db.add(profile)
    return profile


def headers(user):
    return {"Authorization": f"Bearer {create_token(user)}"}


def booking(doctor):
    return {
        "doctor_id": doctor.id,
        "date": TOMORROW.isoformat(),
        "start_time": "10:00",
        "consultation_type": "clinic",
    }


def test_double_booking_returns_409(client, db):
    doctor = add_doctor(db)
    first = add_user(db, "first@example.com", "patient")
    second = add_user(db, "second@example.com", "patient")
    db.commit()

    response = client.post("/api/appointments", json=booking(doctor), headers=headers(first))
    assert response.status_code == 201

    response = client.post("/api/appointments", json=booking(doctor), headers=headers(second))
    assert response.status_code == 409
    assert response.json()["detail"] == "This slot was just booked, please pick another"


def test_cancelled_booking_frees_the_slot(client, db):
    doctor = add_doctor(db)
    first = add_user(db, "first@example.com", "patient")
    second = add_user(db, "second@example.com", "patient")
    db.commit()

    response = client.post("/api/appointments", json=booking(doctor), headers=headers(first))
    appointment_id = response.json()["id"]
    response = client.patch(f"/api/appointments/{appointment_id}/cancel", headers=headers(first))
    assert response.json()["status"] == "cancelled"

    response = client.post("/api/appointments", json=booking(doctor), headers=headers(second))
    assert response.status_code == 201


def test_database_refuses_a_second_booking_for_the_same_slot(db):
    # Even if two requests pass the open-slot check at the same moment, the unique index stops one
    doctor = add_doctor(db)
    patient = add_user(db, "patient@example.com", "patient")
    db.commit()

    for _ in range(2):
        db.add(
            Appointment(
                patient=patient,
                doctor=doctor,
                date=TOMORROW,
                start_time=time(10, 0),
                end_time=time(10, 30),
                consultation_type="clinic",
            )
        )
    with pytest.raises(IntegrityError):
        db.commit()
