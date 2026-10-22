# Setup

How we run MedConnect PK on a Windows machine for development.

## What you need

- Python 3.11 or newer (we use 3.15)
- Node.js 20 or newer (we use 24)
- PostgreSQL 17, running on port 5432

On our machine PostgreSQL is installed at `D:\postgres` and its `bin` folder is not on PATH,
so the commands below use the full path. Change it if yours is somewhere else.

## 1. Create the database

```
D:\postgres\bin\createdb.exe -U postgres -h localhost medconnect
```

It asks for the `postgres` user's password.

## 2. Backend

```
cd backend
py -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Open `backend\.env` and fill it in:

- `DATABASE_URL`: put the real database password in it.
- `JWT_SECRET`: any long random string. Generate one with
  `python -c "import secrets; print(secrets.token_hex(32))"`.
- `SMTP_USER` and `SMTP_PASSWORD`: a Gmail address and a Gmail app password (Google Account, then
  Security, then 2-Step Verification, then App passwords). If you leave `SMTP_USER` empty, OTP codes are
  printed in the backend terminal instead of being emailed, which is fine for development.

Then start the API:

```
uvicorn app.main:app --reload
```

The API runs on http://localhost:8000. Check http://localhost:8000/api/health, which should return
`{"status": "ok", "database": "ok"}`. The interactive API docs are at http://localhost:8000/docs.

We install plain `uvicorn`, not `uvicorn[standard]`. The extras pull in `pyyaml`, which has no
ready-made wheel for Python 3.15 yet and needs a C compiler to build.

## 3. Frontend

In a second terminal:

```
cd frontend
npm install
copy .env.example .env
npm run dev
```

The app runs on http://localhost:5173. `VITE_API_URL` in `frontend\.env` points it at the backend.

## 4. Demo data

The backend creates its tables when it starts, so there is no migration step. To fill the database
with demo doctors, patients and appointments, run this from the `backend` folder (with the venv active):

```
python seed.py --reset
```

`--reset` drops every table first, so it also wipes any accounts you made by hand. Without it, the
script only adds the demo data if it isn't there yet. Appointment dates are worked out from the day you
run it, so run it again before a demo to get fresh upcoming appointments.

It adds 10 approved doctors in Karachi, 1 doctor waiting for approval, 3 patients and an admin.
Every demo account uses the password `demo1234`:

| Role | Email |
|---|---|
| Patient (Ahmed Raza) | ahmed.raza@example.com |
| Doctor (Dr. Ayesha Siddiqui, approved) | ayesha.siddiqui@example.com |
| Doctor (Dr. Mariam Akhtar, pending) | mariam.akhtar@example.com |
| Admin | admin@example.com |

Admin accounts are never created through the app; this script is the only way to get one.

With `DEMO_MODE=true` (backend) and `VITE_DEMO_MODE=true` (frontend), the login and register pages show
an "Explore the patient demo" link that logs straight in as Ahmed Raza.

## 5. Tests

The tests use their own database so they never touch the demo data. Create it once:

```
D:\postgres\bin\createdb.exe -U postgres -h localhost medconnect_test
```

Put its connection string in `TEST_DATABASE_URL` in `backend\.env`, then from the `backend` folder:

```
python -m pytest
```

The tests empty and refill the test database each time. They cover sign up, verification and login,
slot generation, and double booking.

## Environment variables

| File | Variable | What it is |
|---|---|---|
| `backend/.env` | `DATABASE_URL` | PostgreSQL connection string |
| `backend/.env` | `FRONTEND_URL` | Allowed origin for CORS |
| `backend/.env` | `JWT_SECRET` | Secret used to sign login tokens |
| `backend/.env` | `JWT_EXPIRE_MINUTES` | How long a login lasts (default 1440, one day) |
| `backend/.env` | `SMTP_HOST`, `SMTP_PORT` | Mail server, `smtp.gmail.com` and `587` for Gmail |
| `backend/.env` | `SMTP_USER`, `SMTP_PASSWORD` | Gmail address and app password used to send OTP emails |
| `backend/.env` | `DEMO_MODE` | `true` turns on the one-click demo patient login |
| `backend/.env` | `TEST_DATABASE_URL` | Separate database used only by the tests |
| `frontend/.env` | `VITE_API_URL` | Base URL of the backend API |
| `frontend/.env` | `VITE_DEMO_MODE` | `true` shows the "Explore the patient demo" link |

`.env` files are never committed. When we add a new variable we also add it to the matching `.env.example`.
