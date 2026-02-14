import { useNavigate } from "react-router-dom"
import { useAuth } from "../Auth"

export default function Profile(){
    const { setAccessToken, accessToken } = useAuth()
    const navigate = useNavigate()

    function signOut() {
        console.log("sign out button")
        fetch('http://localhost:8000/auth/logout', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            credentials: 'include'
        }).then(async res => {
            console.log('LOGOUT STATUS', res.ok)
            setAccessToken(null)
            navigate('/')
        })
    }

    return (<>
        <h1>Profile [TODO]</h1>
        <div>Access token: {accessToken}</div>
        <button onClick={signOut}>Sign out</button>

        

    </>)
}