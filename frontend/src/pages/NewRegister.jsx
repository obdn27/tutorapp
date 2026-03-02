import { useNavigate, Link } from 'react-router-dom'
import { useState } from 'react'
import { registerStudent, registerTutor, signin } from '../api'

import { lightTheme as t } from '../assets/theme'
import { Book, User, Plus } from 'lucide-react'

export default function Register() {
    const [roleTutor, setRoleTutor] = useState(false)
    
    return (<div className='flex flex-col items-center'>
        <div className={`${t.typography.huge} m-8`}>Register</div>
        <div className={`${t.components.card.base} p-4`}>

            <div className='grid grid-cols-2 gap-x-3'>
                <div className={`${t.components.button.ghostBase} ${t.components.button.ghost} ${t.components.button.ghostHover} ${!roleTutor && t.components.button.ghostSelected}`}
                    onClick={() => {setRoleTutor(false)}}>
                    Student
                </div>
                <div className={`${t.components.button.ghostBase} ${t.components.button.ghost} ${t.components.button.ghostHover} ${roleTutor && t.components.button.ghostSelected}`}
                    onClick={() => {setRoleTutor(true)}}>
                    Tutor
                </div>
            </div>

            {
                roleTutor ?
                <TutorRegister/> :
                <StudentRegister/>
            }
            
        </div>
    </div>)
}

function TutorRegister() {
    const [fName, setFName] = useState('')
    const [lName, setLName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [hourlyRate, setHourlyRate] = useState(10)
    const [currentSubject, setSubject] = useState('')
    const [subjects, setSubjects] = useState([])
    const [bio, setBio] = useState('')
    const [errorMessage, setErroMessage] = useState('')
    const navigate = useNavigate()

    async function handleSubmit(e) {
        e.preventDefault()
        const res = await registerTutor(fName, lName, email, password, subjects, hourlyRate, bio, setErroMessage)
        if (res) {
            const res = await signin(email, password, accessTokenSetter, setErroMessage)
            if (res) { navigate('/dashboard') }
        }
    }

    function removeSubject(indexToRemove) {
        setSubjects(prev => prev.filter((_, i) => i !== indexToRemove));
    }

    function addSubject() {
        if (!(currentSubject in subjects) && (subject != '')) {
            setSubjects(subjects.concat([currentSubject]))
            setSubject('')
        }
    }

    return <form 
        onSubmit={handleSubmit}
        className={'flex flex-col space-y-8 my-4 max-w-lg'}
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

        <label htmlFor="price" className={t.components.input.label}>Hourly rate (£)</label>
        <input 
            type="number" 
            id="hourlyRate"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
            required
            placeholder='Enter your hourly rate'
            className={`${t.components.input.base}`}
        />

        <label htmlFor="subjects" className={t.components.input.label}>Subjects</label>
        <div className='flex flex-row gap-2'>
            {subjects.map((subject, index) => {
                return <button type="button" className={`${t.components.button.secondary}`} key={index} onClick={() => { removeSubject(index) }}>
                    {subject}
                </button>
            })}
        </div>
        <div className='flex flex-row gap-4'>
            <input 
                type="text" 
                id="subject"
                value={currentSubject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder='Add one of your subjects here...'
                className={`${t.components.input.base}`}
            />
            <button type="button" className={`${t.components.button.secondary}`} onClick={addSubject}><Plus/></button>
        </div>

        <div>
            <label htmlFor="bio" className={t.components.input.label}>Bio</label>
            <input 
                type="text" 
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                required
                placeholder='Tell us a bit about yourself here...'
                className={`${t.components.input.base}`}
            />
        </div>

        <button
            type="submit"
            className={`${t.components.button.primary}`}
        >
            Register
        </button>

        <hr className={`${t.colors.border.light}`}/>

        <Link to="/signin" className={`${t.components.link} text-center`}>Sign in instead</Link>
    </form>
}

function StudentRegister() {
    const [fName, setFName] = useState('')
    const [lName, setLName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [errorMessage, setErroMessage] = useState('')
    const navigate = useNavigate()

    async function handleSubmit(e) {
        e.preventDefault()
        const res = await registerStudent(fName, lName, email, password, setErroMessage)
        if (res) {
            const res = await signin(email, password, setErroMessage)
            if (res) { navigate('/dashboard') }
        }
    }

    return <form 
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
}