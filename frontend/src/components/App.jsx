import { useState } from 'react'
import Navbar from './Navbar.jsx'
import Home from '../pages/Home.jsx'
import SignIn from '../pages/SignIn.jsx'
import Profile from '../pages/Profile.jsx'
import Settings from '../pages/Settings.jsx'
import Register from '../pages/Register.jsx'
import { useAuth } from '../Auth.jsx'
import { Routes, Route } from "react-router-dom"
import NewRegister from '../pages/NewRegister.jsx'



function App() {
	console.log("app load")
	const { accessToken } = useAuth()
	const authed = Boolean(accessToken)


	return (<>
			<div className="flex flex-col min-h-screen">
				<Navbar/>
				<div className="flex-grow flex items-center justify-center bg-gray-100">
					<Routes>
						<Route path="/" element={<Home/>}></Route>
						<Route path="/signin" element={<SignIn/>}></Route>
						<Route path="/register" element={<Register/>}></Route>
						<Route path="/profile" element={<Profile/>}></Route>
						<Route path="/settings" element={<Settings/>}></Route>
						<Route path="/newregister" element={<NewRegister/>}></Route>
					</Routes>
				</div>
			</div>
	</>)
}

export default App
