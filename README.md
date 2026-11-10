# MedConnect PK

MedConnect PK is a web platform where patients in Pakistan can find verified doctors and book real,
open appointment slots, either at the clinic or as a home visit. Karachi is the pilot city. It is our
final year project for BS Computer Science at SZABIST Karachi.

Team: Syed Hisham Ali Hashmi and Muhammad Mustafa Giani.
Supervisor: Dr. Husnain Mansoor.

## What this build includes (FYP-I, mid evaluation)

- **Sign up and log in** for patients and doctors, with a 6-digit email code (OTP) to verify the
  email address and to reset a forgotten password. Patients log in on the Patient tab and doctors on
  the Provider tab. "Remember me" keeps you logged in.
- **Doctor onboarding:** doctors give their specialty, PMDC number and experience on the sign up form.
  After verifying their email they add each clinic or hospital they work at (name, area, address and
  the fee there) and can turn on home visits with their own fee. Then they set an appointment length
  and weekly hours, where each time block is at one of their clinics or for home visits. Changing the
  PMDC number or specialty sends the profile back for review.
- **Admin approval:** an admin reviews each doctor and approves or rejects them with a reason. Only
  approved doctors are visible to patients. The admin page also shows live platform counts.
- **Doctor search:** filter by specialty, symptom and consultation type, search by name, clinic or area, and sort
  by earliest available slot, fee or experience. Each doctor shows their next open slot.
- **Booking:** pick a clinic (or a home visit), then a day in the next 14 days and an open slot there.
  The fee shown is the one for that place. Home visits take an address. The same
  slot can never be booked twice, and a patient can't hold two appointments at the same time.
  Patients can reschedule or cancel upcoming appointments.
- **Patient dashboard:** upcoming appointments, a countdown to the next one, and a full list split into
  upcoming, past and cancelled.
- **Doctor dashboard:** today's, this week's and upcoming counts, the appointment list, marking
  visits as completed, and cancelling a booking with a reason the patient can see. Saving new weekly
  hours lists any bookings that fall outside them.
- **Form checks:** every form checks its fields as you fill it in and shows the problem under the field.

Pharmacy orders (cash on delivery) come next in FYP-I. Equipment rental, caretakers, the AI health
assistant, health records, reminders and promo codes are planned for FYP-II. The database already has
all 22 tables from our ERD; the tables for these later features are created empty.

## Tech stack

- Frontend: React 19 (Vite), JavaScript, Tailwind CSS 4, React Router, Axios, lucide-react icons
- Backend: FastAPI, SQLAlchemy 2, Pydantic 2, Uvicorn
- Database: PostgreSQL 17
- Auth: JWT, bcrypt password hashing, email OTP over Gmail SMTP

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
frontend/
  src/
    api/client.js    Axios setup
    context/         logged-in user
    components/      shared UI pieces
    pages/           auth, patient, doctor and admin pages
design/              screen designs
```

## Running it

See [SETUP.md](SETUP.md) for setup, demo logins and how to run the tests.
