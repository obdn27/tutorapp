import { useNavigate, Link } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../Auth'

import { lightTheme as t } from '../assets/theme'

export default function Register() {
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const { setAccessToken } = useAuth()

    const navigate = useNavigate()
    const [errorMessage, setErrorMessage] = useState('')
    
    function handleSubmit(e) {
        e.preventDefault()
        console.log({ username, password })
        fetch('http://localhost:8000/auth/register', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            credentials: 'include',
            body: JSON.stringify({
                username: username,
                password: password
            })
        }).then(async res => {
            const data = await res.json().catch(() => null)

            if (res.ok) {
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

                    if (res.ok) {
                        console.log('LOGIN AFTER REG OK')
                        setAccessToken(data.access_token)
                        navigate('/dashboard')
                    } else {
                        console.log('LOGIN AFTER REG NOT OK')
                        console.log(data.detail, res)
                        setErrorMessage(data.detail)                    
                    }
                })
                setErrorMessage('')
                navigate('/dashboard')
            } else {
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
                    Register
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
                    Register
                </button>
                
                <Link to="/" className={`${t.textSecondary} underline mt-2`}>Sign in</Link>
            </form>
        </div>
    );
}