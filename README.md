# TutorApp

A full-stack tutoring platform prototype built with React, FastAPI, and Supabase Postgres.

Students can browse tutors, view availability, request bookings, reschedule sessions, and message tutors. Tutors can manage their profile, subjects, weekly hours, blocked-off time, bookings, and requests from the same app.

## Stack

- Frontend: React, Vite, React Router, Axios, TanStack Query, Tailwind CSS
- Backend: FastAPI, Python, JWT auth, refresh-token cookies
- Database: Supabase Postgres via `psycopg`

## Features

- Student and tutor registration
- Sign-in, sign-out, token refresh, and password change
- Auto-redirect from sign-in when the user is already authenticated
- Tutor directory with subjects, bios, pricing, and ratings
- Availability calculation from weekly hours, bookings, and off-time blocks
- Booking requests, approval/rejection, rescheduling, and reviews
- Booking-based messaging
- Tutor profile, subject, hours, and off-time management
- Seed script for generating tutor accounts and schedule data

## Project Structure

```text
.
├── frontend/   # React + Vite client
├── backend/    # FastAPI API + Postgres data layer
└── README.md
```

## Running Locally

### 1. Start the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

The API runs on `http://localhost:8000`.

### 2. Start the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The Vite app runs on `http://localhost:5173`.

### 3. Optional: seed tutors

After the backend is running, you can seed tutor accounts, profile details, hours, and off-time data:

```bash
cd backend
source .venv/bin/activate
python3 seed_tutors.py --target localhost --count 20
```

## Environment Variables

The backend reads configuration from `backend/.env`.

Required values:

```env
SUPABASE_DB_URL=postgresql://...
PEPPER=your_password_pepper
JWT_SECRET=your_jwt_secret
CORS_ORIGINS=http://localhost:5173,http://localhost:8000,http://127.0.0.1:8000
```

Add any other origins as required, for example a deployed frontend URL.

The frontend currently defaults to `http://localhost:8000` in code. If you want environment-based API configuration, update `frontend/src/api.js` to use `VITE_API_URL`.

## Main API Areas

- `/auth/*`: registration, sign-in, refresh, sign-out, password change
- `/data/me`: authenticated user profile and role
- `/data/tutors`: public tutor listings
- `/data/availability`: computed tutor availability
- `/data/book` and `/data/can_book`: booking validation and creation
- `/data/bookings/*`: booking list, detail, status, reschedule, review, and messages
- `/data/bookings/requests`: tutor request view
- `/data/tutor/me`: tutor profile management
- `/data/tutor/me/subjects`: tutor subject management
- `/data/hours` and `/data/off_time`: tutor schedule management

## Notes

- The backend schema is created at startup from [backend/schema.py](/Volumes/Programming/OtherLangs/FSD/backend/schema.py).
- The app now uses Supabase Postgres rather than the old local SQLite db.
- `backend/users.db` is out of date
