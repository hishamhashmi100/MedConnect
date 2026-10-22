from sqlalchemy import select

from app.models import OtpCode

EMAIL = "new.patient@example.com"
PASSWORD = "secret123"


def latest_code(db, email):
    # The request ran in another session, so read fresh data
    db.expire_all()
    return db.scalar(
        select(OtpCode.code)
        .where(OtpCode.email == email, OtpCode.purpose == "verify")
        .order_by(OtpCode.created_at.desc())
        .limit(1)
    )


def register(client):
    return client.post(
        "/api/auth/register",
        json={"full_name": "New Patient", "email": EMAIL, "password": PASSWORD, "role": "patient"},
    )


def test_register_verify_login(client, db):
    assert register(client).status_code == 201

    # An unverified account is sent to the OTP screen instead of being logged in
    response = client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert response.status_code == 403
    assert response.json()["detail"]["needs_verification"] is True

    code = latest_code(db, EMAIL)
    response = client.post("/api/auth/verify-otp", json={"email": EMAIL, "code": code})
    assert response.status_code == 200
    assert response.json()["user"]["is_verified"] is True

    response = client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert response.status_code == 200
    token = response.json()["token"]

    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["role"] == "patient"


def test_wrong_code_is_rejected(client, db):
    register(client)
    real_code = latest_code(db, EMAIL)
    wrong_code = "000000" if real_code != "000000" else "111111"

    response = client.post("/api/auth/verify-otp", json={"email": EMAIL, "code": wrong_code})
    assert response.status_code == 400
    assert response.json()["detail"] == "Incorrect code. 4 attempts left"


def test_wrong_password_gives_one_message(client, db):
    register(client)
    response = client.post("/api/auth/login", json={"email": EMAIL, "password": "wrongpass1"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


def test_duplicate_email_is_rejected(client, db):
    register(client)
    response = register(client)
    assert response.status_code == 400
