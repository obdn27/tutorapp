import { useNavigate, Link } from 'react-router-dom'
import { useState } from 'react'

import { lightTheme as t } from '../assets/theme'
import { useAuth } from '../Auth'

export default function SignIn() {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const { setAccessToken } = useAuth()
    
    const navigate = useNavigate()
    const [errorMessage, setErrorMessage] = useState('')

    function handleSubmit(e) {
        e.preventDefault()
        fetch('http://localhost:8000/auth/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            credentials: 'include',
            body: JSON.stringify({
                username: username,
                password: password
            })
        }).then(async res => {
            const data = await res.json().catch(() => null)

            console.log(data, res)
            if (res.ok) {
                console.log('LOGIN OK')
                setAccessToken(data.access_token)
                navigate('/profile')
            } else {
                console.log('LOGIN NOT OK')
                console.log(data.detail, res)
                setErrorMessage(data.detail)                    
            }
        })
    }

    return (
        <div className={`flex justify-center px-12 py-8 ${t.pageBg}`}>
            <form
                onSubmit={handleSubmit}
                className={`flex flex-col gap-4 p-6 rounded
                    ${t.cardBg} ${t.cardBorder} ${t.cardShadow}`}
            >
                <h1 className={`text-xl font-bold ${t.textPrimary}`}>
                    Sign In
                </h1>

                {
                    errorMessage ?                
                    <div className="bg-red-200 p-2 rounded text-sm">{errorMessage}</div> :
                    <div></div>
                }

                <label htmlFor="username" className={t.textSecondary}>
                    Username
                </label>
                <input
                    type="text"
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className={`${t.inputBase} ${t.inputFocus}`}
                />

                <label htmlFor="password" className={t.textSecondary}>
                    Password
                </label>
                <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className={`${t.inputBase} ${t.inputFocus}`}
                />

                <button
                    type="submit"
                    className={`mt-4 p-2 ${t.button}`}
                >
                    Sign In
                </button>
                
                <Link to="/register" className={`${t.textSecondary} underline mt-2`}>Register</Link>
            </form>
        </div>
    )

}
