import requests

BASE_URL = "http://localhost:8000/auth/register_tutor"

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

for tutor in tutors:
    response = requests.post(BASE_URL, json=tutor)
    print(f"{tutor['email']} -> {response.status_code}")
    if response.status_code != 200:
        print(response.text)