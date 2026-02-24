import { useNavigate } from "react-router-dom"
import { useAuth } from "../Auth"
import { lightTheme as t } from "../assets/theme"
import { getSessions, signout } from "../api"
import { useState } from "react"

const SESSIONS = [
    {
        tutorName: "James Miller",
        subject: "English",
        start_ts: (Math.floor(Date.now() / 1000) + (5 * 3600))
    }
]

export default function Dashboard(){
    const { setAccessToken, accessToken } = useAuth()
    const navigate = useNavigate()

    return <div>
        <h1 className={`${t.typography.huge}`}>Welcome back!</h1>
        <p className={`${t.typography.muted}`}>You have sessions scheduled for the next 48 hours</p>

        <SessionsList/>

    </div>
}

function Session({ session }) {
  const date = new Date(session.start_ts * 1000);

  return (
    <div className={`${t.components.card.interactive} p-4 flex items-center gap-4`}>
      {/* time */}
      <div className="w-16 shrink-0 text-center">
        <div className="text-slate-900 font-bold leading-none">
          {date.toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </div>
        <div className={`${t.typography.muted} leading-none mt-1`}>
          {date.toLocaleString("en-GB", { day: "numeric", month: "short" })}
        </div>
      </div>

      {/* details */}
      <div className="min-w-0 flex-1">
        <div className="text-slate-900 font-bold truncate">{session.subject}</div>
        <div className={`${t.typography.muted} truncate`}>with {session.tutorName}</div>
      </div>

      {/* right */}
      <div className="shrink-0">
        <button className={`${t.components.button.secondary} px-4 py-2 rounded-xl`}>
          Details
        </button>
      </div>
    </div>
  );
}

function SessionsList() {
    const [ sessions, setSessions ] = useState(SESSIONS)

    return <div className={`py-4`}>

        <h3 className={`${t.typography.heading} py-2`}>Upcoming sessions</h3>
        {sessions.map((session, index) => (
            <Session key={index} session={session}/>
        ))}

    </div>
}