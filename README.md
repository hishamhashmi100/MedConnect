# MedConnect PK

MedConnect PK is a web platform where patients in Pakistan can find verified doctors and book real,
open appointment slots, either at the clinic or as a home visit. Karachi is the pilot city. It is our
final year project for BS Computer Science at SZABIST Karachi.

Team: Syed Hisham Ali Hashmi and Muhammad Mustafa Giani.
Supervisor: Dr. Husnain Mansoor.

## What this build includes (FYP-I, mid evaluation)

- **Sign up and log in** for patients and doctors, with a 6-digit email code (OTP) to verify the
  email address and to reset a forgotten password. "Remember me" keeps you logged in.
- **Doctor onboarding:** doctors fill in their specialty, PMDC number, fee, location and consultation
  types (in-clinic and/or home visit), and set weekly hours with one or more time blocks per day.
- **Admin approval:** an admin reviews each doctor and approves or rejects them with a reason. Only
  approved doctors are visible to patients. The admin page also shows live platform counts.
- **Doctor search:** filter by specialty, symptom, consultation type and city, search by name, and sort
  by earliest available slot, fee or experience. Each doctor shows their next open slot.
- **Booking:** pick a day in the next 14 days and an open slot. Home visits take an address. The same
  slot can never be booked twice. Patients can reschedule or cancel upcoming appointments.
- **Patient dashboard:** upcoming appointments, a countdown to the next one, and a full list split into
  upcoming, past and cancelled.
- **Doctor dashboard:** today's, this week's and upcoming counts, the appointment list, and marking
  visits as completed.

Pharmacy orders (cash on delivery) come next in FYP-I. Equipment rental, caretakers, the AI health
assistant, health records, reminders and promo codes are planned for FYP-II. The database design for
all of them is already in [docs/schema.md](docs/schema.md), and the diagrams are in [docs/erd](docs/erd).

## Tech stack

- Frontend: React 19 (Vite), JavaScript, Tailwind CSS 4, React Router, Axios, lucide-react icons
- Backend: FastAPI, SQLAlchemy 2, Pydantic 2, Uvicorn
- Database: PostgreSQL 17
- Auth: JWT, bcrypt password hashing, email OTP over Gmail SMTP
- Tests: PyTest

## Project layout

```
backend/
  app/
    main.py          FastAPI app, CORS, routers
    models.py        all database tables
    schemas.py       request and response shapes
    security.py      passwords, tokens, role checks
    slots.py         turns weekly hours into bookable slots
    constants.py     specialties, symptoms, cities
    routers/         auth, meta, doctor, doctors, appointments, admin
  seed.py            demo data
  tests/             PyTest tests
frontend/
  src/
    api/client.js    Axios setup
    context/         logged-in user
    components/      shared UI pieces
    pages/           auth, patient, doctor and admin pages
docs/
  srs-notes.md       notes for the SRS document
  schema.md          database tables and ERD
design/              screen designs
```

## Running it

See [SETUP.md](SETUP.md) for setup, demo logins and how to run the tests.
