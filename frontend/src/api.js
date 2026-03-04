import axios from 'axios'

const APIURL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export const endpoints = {
    'refresh': APIURL + '/auth/refresh',
    'signin': APIURL + '/auth/signin',
    'signout': APIURL + '/auth/signout',
    'registerTutor': APIURL + '/auth/register_tutor',
    'registerStudent': APIURL + '/auth/register_student',
    'sessions': APIURL + '/data/sessions',
    'tutors': APIURL + '/data/tutors',
    'book': APIURL + '/data/book',
    'bookings': APIURL + '/data/bookings',
    'me': APIURL + '/data/me',
    'tutor_availability': APIURL + '/data/availability',
    'can_book': APIURL + '/data/can_book',
    'tutor_me': APIURL + '/data/tutor/me',
}

export const dataClient = axios.create({
    baseURL: APIURL + '/data/',
    headers: {
        'Content-Type': 'application/json',
    }
})

let navigator = null
let accessToken = null
let onAuthFail = null

export function setStoredAccessToken(token) {
    accessToken = token
}

export function getStoredAccessToken() {
    return accessToken
}

export function setAuthFailHandler(fn) {
    onAuthFail = fn
}

export function setNavigator(setter) {
    navigator = setter
}

export async function getMe() {
    const res = await dataClient.get(endpoints.me)
    return res.data
}

dataClient.interceptors.request.use((config) => {
    if (accessToken) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${accessToken}`
        console.log('attaching access token', accessToken)
    }
    return config
})

dataClient.interceptors.response.use(
    (res) => res,
    async (err) => {
        const original = err.config
        console.log(original, err)
        if (!err.response) throw err

        if (original._retry) {
            setStoredAccessToken(null)
            onAuthFail?.()
            throw err
        }
        original._retry = true

        try {
            const newToken = await refresh()
            original.headers.Authorization = `Bearer ${newToken}`
            return dataClient(original)
        } catch {
            setStoredAccessToken(null)
            onAuthFail?.()
            throw err
        }
    }
)

export async function refresh() {
    try {
        const res = await axios.post(endpoints.refresh, {}, { withCredentials: true })
        const token = res.data?.access_token ?? null
        setStoredAccessToken(token)
        return token
    } catch {
        setStoredAccessToken(null)
        navigator('/signin')
        return null
    }
}

export async function signin(email, password, errorMsgSetter, meSetter) {
    try {
        const res = await axios.post(
            endpoints.signin,
            { email, password },
            {
                headers: { 'Content-Type': 'application/json' },
                withCredentials: true,
            }
        )
        const token = res.data?.access_token ?? null
        setStoredAccessToken(token)
        errorMsgSetter('')
        meSetter(await getMe())
        navigator('/dashboard')
        return token
    } catch (err) {
        errorMsgSetter(err.response.data.detail)
        return false
    }
}

export async function signout() {
    try {
        const res = await axios.post(
            endpoints.signout,
            {},
            { withCredentials: true }
        )

        setStoredAccessToken(null)
        navigator('/signin')
        return true
    } catch { return false }
}

export async function registerStudent(fName, lName, email, password, errorMsgSetter) {
    try {
        const res = await axios.post(
            endpoints.registerStudent, {
            first_name: fName,
            last_name: lName,
            email: email,
            password: password,
            role: 0
        }
        )

        errorMsgSetter('')
        return true
    } catch (err) {
        errorMsgSetter(err.response.data.detail)
        return false
    }
}

export async function registerTutor(fName, lName, email, password, subjects, hourlyGBP, bio, errorMsgSetter) {
    try {
        const res = await axios.post(
            endpoints.registerTutor, {
            first_name: fName,
            last_name: lName,
            email: email,
            subjects: subjects,
            hourly_gbp: hourlyGBP,
            password: password,
            bio: bio
        }
        );

        errorMsgSetter('');
        return true;
    } catch (err) {
        errorMsgSetter(err.response.data.detail);
        return false;
    }
}

export async function getBookings() {
    const res = await dataClient.get(endpoints.bookings);
    return res.data;
}

export async function createBooking(payload) {
    const res = await dataClient.post(endpoints.book, payload);
    return res.data;
}

export async function getTutors() {
    const res = await dataClient.get(endpoints.tutors);
    return res.data;
}

export async function getTutorAvailability({ tutorId, startTs, endTs, slotS = 1800 }) {
    const res = await dataClient.get(endpoints.tutor_availability, {
        params: { tutor_id: tutorId, start_ts: startTs, end_ts: endTs, slot_s: slotS },
    });
    return res.data;
}

export async function canBook(payload) {
    const res = await dataClient.post(endpoints.can_book, payload);
    return res.data;
}

export async function getTutorMe() {
    const res = await dataClient.get(endpoints.tutor_me)
    return res.data;
}


export async function getMyHours() {
    const res = await dataClient.get("hours");
    return res.data; // [{ id, weekday, start_s, end_s }]
}

export async function setHours({ weekday, start_s, end_s }) {
    const res = await dataClient.post("hours", { weekday, start_s, end_s });
    return res.data;
}

export async function getOffTimes({ start_ts, end_ts }) {
    const res = await dataClient.get("off_time", { params: { start_ts, end_ts } });
    return res.data; // [{ id, start_ts, end_ts }]
}

export async function addOffTime({ start_ts, end_ts }) {
    const res = await dataClient.post("off_time", { start_ts, end_ts });
    return res.data;
}

export async function deleteOffTime(id) {
    const res = await dataClient.delete(`off_time/${id}`);
    return res.data;
}

export async function leaveReview({ booking_id, rating }) {
    const res = await dataClient.post(`bookings/${booking_id}/review`, { rating });
    return res.data;
}

export async function patchBookingStatus({ booking_id, status }) {
    const res = await dataClient.patch(`bookings/${booking_id}/status`, { status });
    return res.data;
}

export async function patchTutorMe(payload) {
    const res = await dataClient.patch('/tutor/me', payload);
    return res.data;
}

export async function putTutorSubjects(payload) {
    const res = await dataClient.put('/tutor/me/subjects', payload);
    return res.data;
}

export async function changePassword(payload) {
    const res = await axios.post('/auth/change_password', payload, {headers: {Authorization: `Bearer ${accessToken}`}});
    return res.data;
}

export async function getBookingMessages({ booking_id, after_id = null, limit = 80 }) {
  const url = `/bookings/${booking_id}/messages`;
  const params = {};
  if (after_id !== null && after_id !== undefined) params.after_id = after_id;
  if (limit) params.limit = limit;

  const res = await dataClient.get(url, { params });
  // { messages: [...] }
  return res.data;
}

export async function sendBookingMessage({ booking_id, message }) {
  const url = `/bookings/${booking_id}/messages`;
  const res = await dataClient.post(url, { message });
  // { message:"ok", id, created_at }
  return res.data;
}

export async function rescheduleBooking({ booking_id, start_ts, end_ts }) {
  const res = await dataClient.post(`/bookings/${booking_id}/reschedule`, { start_ts, end_ts });
  return res.data;
}