from app.models import DoctorProfile, User
from app.security import create_token, hash_password


def add_user(db, full_name, email, role):
    user = User(
        full_name=full_name,
        email=email,
        password_hash=hash_password("secret123"),
        role=role,
        is_verified=True,
    )
    db.add(user)
    return user


def add_pending_doctor(db):
    profile = DoctorProfile(
        user=add_user(db, "Test Doctor", "doctor@example.com", "doctor"),
        specialty="Cardiologist",
        pmdc_number="12345-P",
        experience_years=5,
        city="Karachi",
        area="Clifton",
        clinic_address="Block 4, Clifton, Karachi",
        fee=2000,
        offers_clinic=True,
        offers_home_visit=False,
    )
    db.add(profile)
    return profile


def headers(user):
    return {"Authorization": f"Bearer {create_token(user)}"}


def profile_form():
    return {
        "specialty": "Cardiologist",
        "pmdc_number": "12345-P",
        "experience_years": 6,
        "city": "Karachi",
        "area": "Clifton",
        "clinic_address": "Block 4, Clifton, Karachi",
        "fee": 2500,
        "offers_clinic": True,
        "offers_home_visit": False,
    }


def test_approval_records_the_admin_and_time(client, db):
    admin = add_user(db, "Admin Team", "admin@example.com", "admin")
    doctor = add_pending_doctor(db)
    db.commit()

    response = client.post(f"/api/admin/doctors/{doctor.id}/approve", headers=headers(admin))
    assert response.status_code == 200
    assert response.json()["reviewed_by_name"] == "Admin Team"
    assert response.json()["reviewed_at"] is not None

    db.refresh(doctor)
    assert doctor.reviewed_by == admin.id


def test_rejection_records_the_admin(client, db):
    admin = add_user(db, "Admin Team", "admin@example.com", "admin")
    doctor = add_pending_doctor(db)
    db.commit()

    response = client.post(
        f"/api/admin/doctors/{doctor.id}/reject",
        json={"reason": "PMDC number could not be verified"},
        headers=headers(admin),
    )
    assert response.status_code == 200
    assert response.json()["approval_status"] == "rejected"
    assert response.json()["reviewed_by_name"] == "Admin Team"


def test_resubmitting_a_rejected_profile_clears_the_review(client, db):
    admin = add_user(db, "Admin Team", "admin@example.com", "admin")
    doctor = add_pending_doctor(db)
    db.commit()
    client.post(
        f"/api/admin/doctors/{doctor.id}/reject",
        json={"reason": "PMDC number could not be verified"},
        headers=headers(admin),
    )

    response = client.put("/api/doctor/profile", json=profile_form(), headers=headers(doctor.user))
    assert response.status_code == 200
    assert response.json()["approval_status"] == "pending"

    db.refresh(doctor)
    assert doctor.reviewed_by is None
    assert doctor.reviewed_at is None
