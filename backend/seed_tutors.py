import random
import time
import string
import requests
from datetime import datetime, timedelta, timezone

API = "https://tutorapp-r5kb.onrender.com"

REGISTER_TUTOR = f"{API}/auth/register_tutor"
SIGNIN = f"{API}/auth/signin"
SET_HOURS = f"{API}/data/hours"
ADD_OFFTIME = f"{API}/data/off_time"

# ---------- config ----------
N_TUTORS = 20

SUBJECT_POOL = [
    "Maths", "Further Maths", "Physics", "Chemistry", "Biology",
    "English", "English Literature", "History", "Geography",
    "Computer Science", "Economics", "Psychology", "Sociology",
    "Politics", "Philosophy", "French", "Spanish", "German",
    "Statistics", "Business", "Media Studies"
]

FIRST_NAMES = [
    "Amelia", "Noah", "Olivia", "Liam", "Isla", "Ethan", "Mia", "Lucas", "Sophia", "Ava",
    "James", "Leo", "Grace", "Ella", "Hector", "Daniel", "Harper", "Chloe", "Finn", "Zara",
    "Alex", "Sam", "Taylor", "Rowan", "Casey", "Jordan"
]

LAST_NAMES = [
    "Clark", "Evans", "Morgan", "Bennett", "Turner", "Shaw", "Reed", "Foster", "Wales", "Price",
    "Green", "Hall", "Wright", "Baker", "Adams", "Hill", "Parker", "Cooper", "Ward", "Scott"
]

BIO_TEMPLATES = [
    "I help students build confidence and improve exam technique with structured sessions.",
    "Focused on A-Level outcomes: clear explanations, targeted practice, and weekly goals.",
    "Friendly but rigorous tutoring — I’ll push you to understand, not memorise.",
    "I specialise in past paper strategies and breaking down difficult topics.",
    "Supportive, patient teaching style with lots of worked examples and quick feedback."
]

# ---------- helpers ----------

def rand_email(i: int) -> str:
    # stable-ish emails so you can rerun by changing prefix if needed
    return f"seed_tutor_{i:02d}@example.com"

def rand_password() -> str:
    return "123"  # keep simple for seeding

def pick_subjects():
    k = random.randint(2, 5)
    return random.sample(SUBJECT_POOL, k)

def rand_rate():
    return random.choice([15, 18, 20, 22, 25, 28, 30, 35])

def rand_bio(subjects):
    base = random.choice(BIO_TEMPLATES)
    focus = f"Subjects: {', '.join(subjects[:3])}."
    return f"{base} {focus}"

def utc_ts(dt: datetime) -> int:
    return int(dt.replace(tzinfo=timezone.utc).timestamp())

def weekday_hours_pattern():
    """
    Returns dict weekday -> (start_s, end_s).
    weekday: 0=Mon..6=Sun
    start_s/end_s: seconds from midnight (your schema)
    """
    # common patterns
    patterns = [
        # 9-17
        {0:(9*3600,17*3600),1:(9*3600,17*3600),2:(9*3600,17*3600),3:(9*3600,17*3600),4:(9*3600,17*3600)},
        # 10-18
        {0:(10*3600,18*3600),1:(10*3600,18*3600),2:(10*3600,18*3600),3:(10*3600,18*3600),4:(10*3600,18*3600)},
        # 16-20 evenings
        {0:(16*3600,20*3600),1:(16*3600,20*3600),2:(16*3600,20*3600),3:(16*3600,20*3600),4:(16*3600,20*3600)},
        # mixed
        {0:(9*3600,15*3600),1:(12*3600,18*3600),2:(9*3600,15*3600),3:(12*3600,18*3600),4:(9*3600,15*3600)},
    ]
    hours = random.choice(patterns).copy()

    # optional Saturday availability
    if random.random() < 0.5:
        hours[5] = (random.choice([10,11,12]) * 3600, random.choice([14,15,16,17]) * 3600)

    # rarely Sunday
    if random.random() < 0.15:
        hours[6] = (12*3600, 16*3600)

    return hours

def post_json(url, payload, headers=None, cookies=None, timeout=10):
    r = requests.post(url, json=payload, headers=headers or {}, cookies=cookies or {}, timeout=timeout)
    return r

def seed_one_tutor(i: int):
    first = random.choice(FIRST_NAMES)
    last = random.choice(LAST_NAMES)
    email = rand_email(i)
    pwd = rand_password()
    subjects = pick_subjects()
    hourly = rand_rate()
    bio = rand_bio(subjects)

    # 1) register
    r = post_json(REGISTER_TUTOR, {
        "first_name": first,
        "last_name": last,
        "email": email,
        "password": pwd,
        "hourly_gbp": hourly,
        "subjects": subjects,
        "bio": bio,
    })

    if r.status_code != 200:
        return False, f"register failed {email}: {r.status_code} {r.text}"

    # 2) signin to get cookie + access token
    s = requests.Session()
    r2 = s.post(SIGNIN, json={"email": email, "password": pwd}, timeout=10)
    if r2.status_code != 200:
        return False, f"signin failed {email}: {r2.status_code} {r2.text}"

    token = r2.json().get("access_token")
    if not token:
        return False, f"no access token for {email}"

    headers = {"Authorization": f"Bearer {token}"}

    # 3) set weekly hours
    hours = weekday_hours_pattern()
    for wd, (start_s, end_s) in hours.items():
        rh = post_json(SET_HOURS, {"weekday": wd, "start_s": start_s, "end_s": end_s}, headers=headers, cookies=s.cookies.get_dict())
        if rh.status_code != 200:
            return False, f"set_hours failed {email} wd={wd}: {rh.status_code} {rh.text}"

    # 4) add random off-times in next 14 days
    # (these are timestamp ranges)
    now = datetime.now(timezone.utc)
    for _ in range(random.randint(1, 4)):
        day_offset = random.randint(0, 13)
        day = (now + timedelta(days=day_offset)).replace(hour=0, minute=0, second=0, microsecond=0)

        # block 1-3 hours somewhere between 9 and 18
        start_hour = random.randint(9, 17)
        duration_h = random.choice([1, 1, 2, 2, 3])
        start = day + timedelta(hours=start_hour, minutes=random.choice([0, 30]))
        end = start + timedelta(hours=duration_h)

        ro = post_json(
            ADD_OFFTIME,
            {"start_ts": utc_ts(start), "end_ts": utc_ts(end)},
            headers=headers,
            cookies=s.cookies.get_dict()
        )
        if ro.status_code != 200:
            # don’t hard fail; offTimes can overlap (you haven’t constrained overlaps)
            pass

    return True, f"seeded {email} ({first} {last})"

def main():
    random.seed(42)

    ok = 0
    for i in range(1, N_TUTORS + 1):
        success, msg = seed_one_tutor(i)
        print(msg)
        if success:
            ok += 1
        time.sleep(0.05)

    print(f"\nDone: {ok}/{N_TUTORS} tutors seeded.")

if __name__ == "__main__":
    main()