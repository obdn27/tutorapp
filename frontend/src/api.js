import axios from 'axios'

const APIURL = 'http://localhost:8000'

const endpoints = {
    'refresh': APIURL + '/auth/refresh',
    'signin': APIURL + '/auth/login',
    'signout': APIURL + '/auth/logout',
    'register': APIURL + '/auth/register',
    'sessions': APIURL + '/auth/sessions'
}

export async function refresh(accessTokenSetter) {
    console.log("trying to refresh")
    try {
        const res = await axios.post(
            endpoints.refresh,
            {},
            { withCredentials: true }
        )

        if (res.status) {
            accessTokenSetter(res.data.access_token)
        } else {
            accessTokenSetter(null)
        }
        return true
    } catch {return false}
}

export async function signin(email, password, accessTokenSetter, errorMsgSetter) {
    try {
        const res = await axios.post(
            endpoints.signin,
            { email, password },
            {
                headers: { "Content-Type": "application/json" },
                withCredentials: true,
            }
        )

        errorMsgSetter('')
        accessTokenSetter(res.data.access_token)
        return true
    } catch (err) {
        errorMsgSetter(err.response.data.detail)
        return false
    }
}

export async function signout(accessTokenSetter) {
    try {
        const res = await axios.post(
            endpoints.signout,
            { withCredentials: true }
        )
        accessTokenSetter(null)
        return true
    } catch {return false}
}

export async function register(fName, lName, email, password, roleTutor, errorMsgSetter) {
    try {
        const res = await axios.post(
            endpoints.register, {
                first_name: fName,
                last_name: lName,
                email: email,
                password: password,
                role: roleTutor
            }
        )

        errorMsgSetter('')
        return true
    } catch (err) {
        errorMsgSetter(err.response.data.detail)
        return false
    }
}

export async function getSessions(accessToken) {
    try {
        const res = await axios.get(
            endpoints.sessions, {
                headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}`}
            }
        )

        if (res.status === 401) {
            return false
        }
        return true
    } catch { return false }
}