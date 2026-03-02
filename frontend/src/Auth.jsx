import { createContext, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { refresh, getMe, signout as apiSignout } from './api'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [loading, setLoading] = useState(true)
    const [me, setMe] = useState(null)
    const navigate = useNavigate()

    useEffect(() => {
        (async () => {
            const token = await refresh()
            if (token) {
                try {
                    const user = await getMe()
                    setMe(user)
                    navigate('/dashboard')
                } catch {
                    setMe(null)
                }
            } else {
                setMe(null)
            }
            setLoading(false)
        })()
    }, [])

    const signout = async () => {
        await apiSignout()
        setMe(null)
    }

    return (
        <AuthContext value={{ loading, me, setMe, signout }}>
            {children}
        </AuthContext>
    )
}


export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
    return ctx;
}