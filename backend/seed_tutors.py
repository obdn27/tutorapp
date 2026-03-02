import requests
import random

API = "http://localhost:8000"

REGISTER_URL = f"{API}/auth/register_tutor"
LOGIN_URL = f"{API}/auth/login"
SET_HOURS_URL = f"{API}/data/hours"

tutors = [
    {
        "first_name": "Hector",
        "last_name": "Wales",
        "email": "hectorwales@gmail.com",
        "password": "123",
        "hourly_gbp": 15,
        "subjects": ["English", "Physics", "Maths"],
        "bio": "Experienced English and Physics tutor."
    },
    {
        "first_name": "Amelia",
        "last_name": "Clark",
        "email": "amelia.clark@gmail.com",
        "password": "123",
        "hourly_gbp": 25,
        "subjects": ["Maths", "Further Maths", "Statistics"],
        "bio": "A-Level Maths specialist."
    },
    {
        "first_name": "Daniel",
        "last_name": "Shaw",
        "email": "daniel.shaw@gmail.com",
        "password": "123",
        "hourly_gbp": 20,
        "subjects": ["Biology", "Chemistry", "Physics"],
        "bio": "Helping students excel in science."
    },
    {
        "first_name": "Sophia",
        "last_name": "Turner",
        "email": "sophia.turner@gmail.com",
        "password": "123",
        "hourly_gbp": 30,
        "subjects": ["History", "Politics", "Philosophy"],
        "bio": "Essay writing and exam prep expert."
    },
    {
        "first_name": "Liam",
        "last_name": "Evans",
        "email": "liam.evans@gmail.com",
        "password": "123",
        "hourly_gbp": 18,
        "subjects": ["Computer Science", "Maths", "Physics"],
        "bio": "Programming and algorithms tutor."
    },
    {
        "first_name": "Olivia",
        "last_name": "Morgan",
        "email": "olivia.morgan@gmail.com",
        "password": "123",
        "hourly_gbp": 22,
        "subjects": ["Psychology", "Sociology", "Biology"],
        "bio": "Social sciences tutor."
    },
    {
        "first_name": "Noah",
        "last_name": "Reed",
        "email": "noah.reed@gmail.com",
        "password": "123",
        "hourly_gbp": 17,
        "subjects": ["English Literature", "History", "Drama"],
        "bio": "Literature and analysis support."
    },
    {
        "first_name": "Mia",
        "last_name": "Bennett",
        "email": "mia.bennett@gmail.com",
        "password": "123",
        "hourly_gbp": 28,
        "subjects": ["Physics", "Maths", "Further Maths"],
        "bio": "STEM-focused tutoring."
    },
    {
        "first_name": "Ethan",
        "last_name": "Price",
        "email": "ethan.price@gmail.com",
        "password": "123",
        "hourly_gbp": 19,
        "subjects": ["Geography", "Environmental Science", "Biology"],
        "bio": "Geography specialist."
    },
    {
        "first_name": "Isla",
        "last_name": "Foster",
        "email": "isla.foster@gmail.com",
        "password": "123",
        "hourly_gbp": 24,
        "subjects": ["French", "Spanish", "English"],
        "bio": "Modern languages tutor."
    }
]

def hm_to_seconds(h: int, m: int = 0) -> int:
    return h * 3600 + m * 60

def login_get_token(email: str, password: str) -> str | None:
    r = requests.post(
        LOGIN_URL,
        json={"email": email, "password": password},
        # if your backend sets refresh cookie on login, this allows it,
        # but not strictly required for access_token response:
        # cookies/session not needed unless your login depends on it
    )
    if r.status_code != 200:
        print(f"LOGIN FAIL {email} -> {r.status_code}: {r.text}")
        return None
    return (r.json() or {}).get("access_token")

def seed_week_hours(token: str, *, start_s: int, end_s: int, weekdays: list[int]) -> None:
    headers = {"Authorization": f"Bearer {token}"}

    for wd in weekdays:
        payload = {"weekday": wd, "start_s": start_s, "end_s": end_s}
        r = requests.post(SET_HOURS_URL, json=payload, headers=headers)

        # if you used UPSERT semantics, you might return 200/201
        # if uniqueness constraint hits and you don't handle update, you might get 409/400
        if r.status_code not in (200, 201):
            print(f"  hours wd={wd} -> {r.status_code}: {r.text}")

def main():
    # deterministic-ish variations
    random.seed(7)

    for tutor in tutors:
        # 1) register
        reg = requests.post(REGISTER_URL, json=tutor)
        print(f"{tutor['email']} -> register {reg.status_code}")
        if reg.status_code not in (200, 201):
            print(reg.text)
            # If already exists, still try to login + seed hours
            # continue

        # 2) login for access token
        token = login_get_token(tutor["email"], tutor["password"])
        if not token:
            continue

        # 3) seed availability (Mon-Fri)
        # one interval per weekday due to UNIQUE(user_id, weekday)
        # vary start/end slightly per tutor so it's not all identical
        start_hour = random.choice([9, 10, 11, 12])
        end_hour = start_hour + random.choice([6, 7, 8])  # 6-8 hr day
        end_hour = min(end_hour, 20)  # cap

        start_s = hm_to_seconds(start_hour, 0)
        end_s = hm_to_seconds(end_hour, 0)

        print(f"  seeding hours {start_hour:02d}:00-{end_hour:02d}:00 (Mon-Fri)")
        seed_week_hours(token, start_s=start_s, end_s=end_s, weekdays=[0, 1, 2, 3, 4])

if __name__ == "__main__":
    main()