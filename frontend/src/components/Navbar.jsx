import { Link } from 'react-router-dom'
import { House, User, Settings } from 'lucide-react'
import { lightTheme as t } from '../assets/theme';

import { useAuth } from '../Auth';

function Navbar(){
    const { accessToken } = useAuth()

    return <nav className={`flex justify-end ${t.cardBg} ${t.textPrimary} ${t.cardShadow} p-4`}>
        {accessToken}
        <Link to="/" className={`${t.textPrimary} px-4`}><House strokeWidth={2.5}/></Link>
        <Link to={Boolean(accessToken) ? '/dashboard' : '/'} className={`${t.textPrimary} px-4`}><User strokeWidth={2.5}/></Link>
        <Link to="/settings" className={`${t.textPrimary} px-4`}><Settings strokeWidth={2.5}/></Link>
    </nav>
}

export default Navbar