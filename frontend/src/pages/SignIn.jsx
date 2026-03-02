import { Link } from 'react-router-dom'
import { useState } from 'react'
import { lightTheme as t } from '../assets/theme'
import { signin } from '../api'
import { useAuth } from '../Auth'

export default function SignIn() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')    
    const { setMe } = useAuth()
    const [errorMessage, setErrorMessage] = useState('')

    async function handleSubmit(e) {
        e.preventDefault()
        const res = await signin(email, password, setErrorMessage, setMe)
    }

    return (<div className='flex flex-col items-center'>
        <div className={`${t.typography.huge} m-8`}>Sign in</div>
        <div className={`${t.components.card.base} p-4 min-w-sm`}>

            <form 
                onSubmit={handleSubmit}
                className={'flex flex-col space-y-8 mb-4'}
            >
                {
                    errorMessage ?                
                    <div className={`${t.colors.status.error} rounded-xl px-4 py-3 text-center`}>{errorMessage}</div> :
                    <div></div>
                }

                <label htmlFor="email" className={t.components.input.label}>Email</label>
                <input 
                    type="text" 
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder='Enter your email'
                    className={`${t.components.input.base}`}
                />
                
                <label htmlFor="password" className={t.components.input.label}>Password</label>
                <input 
                    type="password" 
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder='Enter your password'
                    className={`${t.components.input.base}`}
                />

                <button
                    type="submit"
                    className={`${t.components.button.primary}`}
                >
                    Sign in
                </button>

                <hr className={`${t.colors.border.light}`}/>

                <Link to="/register" className={`${t.components.link} text-center`}>Create an account</Link>
            </form>
            
        </div>
    </div>)

}
