import { useState } from 'react'
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { Navbar } from './Navbar.jsx'
import { SignIn } from './SignIn.jsx'
import { Profile } from './Profile.jsx'
import { Settings } from './Settings.jsx'


function App() {

	return (<>
		<BrowserRouter>
			<Navbar/>
			<Routes>
				<Route path="/signin" element={<SignIn/>}></Route>
				<Route path="/profile" element={<Profile/>}></Route>
				<Route path="/settings" element={<Settings/>}></Route>
			</Routes>
		</BrowserRouter>
	</>)
}

export default App
