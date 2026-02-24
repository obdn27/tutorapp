import { useNavigate, Link } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../Auth'
import { register, signin } from '../api'

import { lightTheme as t } from '../assets/theme'
import { Book, User } from 'lucide-react'

export default function Register() {
    const [fName, setFName] = useState('')
    const [lName, setLName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [roleTutor, setRoleStudent] = useState(false)

    const { setAccessToken } = useAuth()

    const navigate = useNavigate()
    const [errorMessage, setErroMessage] = useState('')

    const selectedStyles = 'font-semibold'
    const unselectedStyles = `bg-${t.cardBorder}`

    async function handleSubmit(e) {
        e.preventDefault()
        if (await register(fName, lName, email, password, roleTutor, setErroMessage)) {
            if (await signin(email, password, setAccessToken, setErroMessage))
            navigate('/dashboard')
        }
    }
    
    return (<div className='flex flex-col items-center'>
        <div className={`${t.typography.huge} m-8`}>Register</div>
        <div className={`${t.components.card.base} p-4`}>

            <div className='grid grid-cols-2 gap-x-3'>
                <div className={`${t.components.button.ghostBase} ${t.components.button.ghost} ${t.components.button.ghostHover} ${!roleTutor && t.components.button.ghostSelected}`}
                    onClick={() => {setRoleStudent(false)}}>
                    Student
                </div>
                <div className={`${t.components.button.ghostBase} ${t.components.button.ghost} ${t.components.button.ghostHover} ${roleTutor && t.components.button.ghostSelected}`}
                    onClick={() => {setRoleStudent(true)}}>
                    Tutor
                </div>
            </div>

            <form 
                onSubmit={handleSubmit}
                className={'flex flex-col space-y-8 my-4'}
            >

                {
                    errorMessage ?                
                    <div className={`${t.colors.status.error} rounded-xl px-4 py-3 text-center`}>{errorMessage}</div> :
                    <div></div>
                }

                <div className={`flex flex-row space-x-4`}>
                    <div>
                        <label htmlFor="fName" className={t.components.input.label}>First name</label>
                        <input 
                            type="text" 
                            id="fName"
                            value={fName}
                            onChange={(e) => setFName(e.target.value)}
                            required
                            placeholder='Enter your first name'
                            className={`${t.components.input.base}`}
                        />
                    </div>

                    <div>
                        <label htmlFor="lName" className={t.components.input.label}>Last name</label>
                        <input 
                            type="text" 
                            id="lName"
                            value={lName}
                            onChange={(e) => setLName(e.target.value)}
                            required
                            placeholder='Enter your last name'
                            className={`${t.components.input.base}`}
                        />
                    </div>
                </div>

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
                    Register
                </button>

                <hr className={`${t.colors.border.light}`}/>

                <Link to="/signin" className={`${t.components.link} text-center`}>Sign in instead</Link>
            </form>
            
        </div>
    </div>)
}