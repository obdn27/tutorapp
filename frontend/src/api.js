import axios from 'axios'

const APIURL = 'http://localhost:8000'

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
    'me': APIURL + '/data/me'
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

export function setStoredAccessToken(token){
    accessToken = token
}

export function getStoredAccessToken(){
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

export async function signin(email, password, errorMsgSetter) {
    try {
        const res = await axios.post(
            endpoints.signin,
            { email, password },
            {
                headers: { 'Content-Type': 'application/json' },
                withCredentials: true,
            }
        )
        console.log(res)
        const token = res.data?.access_token ?? null
        setStoredAccessToken(token)
        errorMsgSetter('')
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
    } catch {return false}
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
        )

        errorMsgSetter('')
        return true
    } catch (err) {
        errorMsgSetter(err.response.data.detail)
        return false
    }
}

export async function getBookings() {
    const res = await dataClient.get(endpoints.bookings)
    return res.data
}

export async function createBooking(payload) {
    const res = await dataClient.post("book", payload)
    return res.data
}