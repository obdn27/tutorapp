# TutorApp

A full-stack tutoring marketplace prototype built with React, FastAPI, and SQLite.

Students can browse tutors, view availability, request bookings, reschedule sessions, leave reviews, and message tutors. Tutors can manage their profile, subjects, weekly hours, blocked-off time, and booking requests from the same app.

## Stack

- Frontend: React, Vite, React Router, Axios, TanStack Query, Tailwind CSS
- Backend: FastAPI, Python, JWT auth, refresh-token cookies
- Database: SQLite

## Features

- Student and tutor registration
- Sign-in, sign-out, token refresh, and password change functionality
- Tutor directory with subjects, bios, pricing, and ratings
- Availability calculation from weekly hours, bookings, and off-time blocks
- Booking requests, status updates, and rescheduling
- Tutor schedule management
- Booking-based messaging
- Post-session reviews and ratings

## Project Structure

```text
.
├── frontend/   # React + Vite client
├── backend/    # FastAPI API + SQLite data layer
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

## Environment Variables

The backend reads configuration from `backend/.env`.

Required values:

```env
PEPPER=your_password_pepper
JWT_SECRET=your_jwt_secret
CORS_ORIGINS=http://localhost:5173,http://localhost:8000,http://127.0.0.1:8000
```

The frontend can optionally use:

```env
VITE_API_URL=http://localhost:8000
```

If `VITE_API_URL` is not set, the frontend already defaults to `http://localhost:8000`.

## Main API Areas

- `/auth/*`: registration, sign-in, refresh, sign-out, password change
- `/data/tutors`: public tutor listings
- `/data/availability`: computed tutor availability
- `/data/book`: booking creation
- `/data/bookings/*`: booking list, detail, status, reschedule, review, messages
- `/data/tutor/me`: tutor profile management
- `/data/hours` and `/data/off_time`: tutor schedule management

## Notes

- SQLite data is stored in `backend/users.db`.
- The frontend includes a GitHub Pages deploy script via `npm run deploy`.
