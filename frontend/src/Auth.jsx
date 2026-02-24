import { createContext, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { refresh } from './api'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [accessToken, setAccessToken] = useState(null)
    const [loading, setLoading] = useState(true)

    const navigate = useNavigate()

    useEffect(() => {
        if (refresh(setAccessToken)) { navigate('/dashboard') }
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