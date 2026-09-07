import argparse
import os
import random
import time
import requests
from datetime import datetime, timedelta, timezone

DEFAULT_TARGETS = {
    "render": "https://tutorapp-r5kb.onrender.com",
    "localhost": "http://localhost:8000",
    "local": "http://localhost:8000",
}

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

def build_endpoints(api_base: str) -> dict[str, str]:
    api = api_base.rstrip("/")
    return {
        "register_tutor": f"{api}/auth/register_tutor",
        "signin": f"{api}/auth/signin",
        "patch_tutor_me": f"{api}/data/tutor/me",
        "put_tutor_subjects": f"{api}/data/tutor/me/subjects",
        "set_hours": f"{api}/data/hours",
        "add_offtime": f"{api}/data/off_time",
    }

def resolve_api_base(target: str | None, api: str | None) -> str:
    if api:
        return api.rstrip("/")
    if target:
        resolved = DEFAULT_TARGETS.get(target.lower())
        if resolved:
            return resolved
        return target.rstrip("/")

    env_api = os.getenv("SEED_API_URL")
    if env_api:
        return env_api.rstrip("/")

    return DEFAULT_TARGETS["render"]

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

def seed_one_tutor(i: int, endpoints: dict[str, str]):
    first = random.choice(FIRST_NAMES)
    last = random.choice(LAST_NAMES)
    email = rand_email(i)
    pwd = rand_password()
    subjects = pick_subjects()
    hourly = rand_rate()
    bio = rand_bio(subjects)

    # 1) register
    r = post_json(endpoints["register_tutor"], {
        "first_name": first,
        "last_name": last,
        "email": email,
        "password": pwd,
        "hourly_gbp": hourly,
        "subjects": subjects,
        "bio": bio,
    })

    if r.status_code not in (200, 409):
        return False, f"register failed {email}: {r.status_code} {r.text}"

    was_created = r.status_code == 200

    # 2) signin to get cookie + access token
    s = requests.Session()
    r2 = s.post(endpoints["signin"], json={"email": email, "password": pwd}, timeout=10)
    if r2.status_code != 200:
        return False, f"signin failed {email}: {r2.status_code} {r2.text}"

    token = r2.json().get("access_token")
    if not token:
        return False, f"no access token for {email}"

    headers = {"Authorization": f"Bearer {token}"}

    # 3) ensure tutor profile exists and is up to date for both new and existing tutors
    rp = s.patch(
        endpoints["patch_tutor_me"],
        json={"hourly_gbp": hourly, "bio": bio},
        headers=headers,
        timeout=10,
    )
    if rp.status_code != 200:
        return False, f"patch_tutor_me failed {email}: {rp.status_code} {rp.text}"

    rs = s.put(
        endpoints["put_tutor_subjects"],
        json={"subjects": subjects},
        headers=headers,
        timeout=10,
    )
    if rs.status_code != 200:
        return False, f"put_tutor_subjects failed {email}: {rs.status_code} {rs.text}"

    # 4) set weekly hours
    hours = weekday_hours_pattern()
    for wd, (start_s, end_s) in hours.items():
        rh = post_json(
            endpoints["set_hours"],
            {"weekday": wd, "start_s": start_s, "end_s": end_s},
            headers=headers,
            cookies=s.cookies.get_dict(),
        )
        if rh.status_code != 200:
            return False, f"set_hours failed {email} wd={wd}: {rh.status_code} {rh.text}"

    # 5) add random off-times in next 14 days
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
            endpoints["add_offtime"],
            {"start_ts": utc_ts(start), "end_ts": utc_ts(end)},
            headers=headers,
            cookies=s.cookies.get_dict()
        )
        if ro.status_code != 200:
            # don’t hard fail; offTimes can overlap (you haven’t constrained overlaps)
            pass

    action = "seeded" if was_created else "updated existing"
    return True, f"{action} {email} ({first} {last})"

def parse_args():
    parser = argparse.ArgumentParser(description="Seed tutor accounts and availability data.")
    parser.add_argument(
        "--target",
        default=None,
        help="Named target or URL. Supported names: render, localhost.",
    )
    parser.add_argument(
        "--api",
        default=None,
        help="Explicit API base URL, e.g. http://localhost:8000",
    )
    parser.add_argument(
        "--count",
        type=int,
        default=N_TUTORS,
        help=f"How many tutors to seed. Default: {N_TUTORS}",
    )
    return parser.parse_args()

def main():
    args = parse_args()
    api_base = resolve_api_base(args.target, args.api)
    endpoints = build_endpoints(api_base)

    random.seed(42)
    print(f"Seeding tutors via {api_base}")

    ok = 0
    for i in range(1, args.count + 1):
        success, msg = seed_one_tutor(i, endpoints)
        print(msg)
        if success:
            ok += 1
        time.sleep(0.05)

    print(f"\nDone: {ok}/{args.count} tutors processed.")

if __name__ == "__main__":
    main()
