import { createContext, useContext, useEffect, useState } from 'react'
import { UNSAFE_WithComponentProps, useNavigate } from 'react-router-dom'
import axios from 'axios';

export const APIURL = 'http://localhost:8000'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [accessToken, setAccessToken] = useState(null)
    const [loading, setLoading] = useState(true)

    const navigate = useNavigate()

    useEffect(() => {
        (async () => {
            try {
                const res = await axios.post(
                    `${APIURL}/auth/refresh`,
                    { withCredentials: true }
                )

                console.log(res)

                if (res.ok) {
                    const data = await res.json()
                    setAccessToken(data.access_token)
                } else {
                    setAccessToken(null)
                    navigate('/signin')
                }
            } catch {
                console.log('failed to refresh')
            }
            
        })()
        setLoading(false)
    }, [])

    return (
        <AuthContext value={{ accessToken, setAccessToken, loading}}>
            {children}
        </AuthContext>
    )
}


export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
    return ctx;
}