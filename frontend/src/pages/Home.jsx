import { lightTheme as t } from "../assets/theme"
import { useAuth } from "../Auth"

export default function Home(){
    const { accessToken } = useAuth()

    return <div className={`p-4 ${t.cardBg} ${t.cardBorder} ${t.cardShadow} rounded min-w-screen p-5`}>
        <h1 className="text-xl font-bold">Welcome to TutorApp</h1>

        {
            accessToken ?
            <div>Signed in with access token: <pre>{accessToken}</pre></div> :
            <div>Currently signed out</div>
        }
    </div>
}