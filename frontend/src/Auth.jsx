import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [accessToken, setAccessToken] = useState(null);
    const [loading, setLoading] = useState(true);

    const navigate = useNavigate()

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('http://localhost:8000/auth/refresh', {
                    method: 'POST', 
                    credentials: 'include'
                })

                if (res.ok) {
                    const data = await res.json()
                    setAccessToken(data.access_token)
                } else {
                    setAccessToken(null)
                    navigate('/signin')
                }
            } finally {
                setLoading(false)
            }

        })()
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