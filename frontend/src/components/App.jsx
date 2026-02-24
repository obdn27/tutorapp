import { useEffect, useState } from 'react'
import SignIn from '../pages/SignIn.jsx'
import Dashboard from '../pages/Dashboard.jsx'
import { useAuth } from '../Auth.jsx'
import { Routes, Route } from "react-router-dom"
import NewRegister from '../pages/NewRegister.jsx'
import Book from '../pages/Book.jsx'


function App() {
	console.log("app load")
	const { accessToken } = useAuth()
	const authed = Boolean(accessToken)

	return (<>
			<div className="flex flex-col min-h-screen">
				authed: {accessToken}

				<div className="flex-grow flex items-center justify-center bg-gray-100">
					<Routes>
						<Route path="/signin" element={<SignIn/>}></Route>
						<Route path="/dashboard" element={<Dashboard/>}></Route>
						<Route path="/register" element={<NewRegister/>}></Route>
						<Route path="/book" element={<Book/>}></Route>
					</Routes>
				</div>
			</div>
	</>)
}

export default App
