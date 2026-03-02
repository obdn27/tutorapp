import { lightTheme as t } from '../assets/theme.js'
import SignIn from '../pages/SignIn.jsx'
import Dashboard from '../pages/Dashboard.jsx'
import { useAuth } from '../Auth.jsx'
import { Routes, Route, useNavigate } from "react-router-dom"
import NewRegister from '../pages/NewRegister.jsx'
import Book from '../pages/Book.jsx'

import { Home, Search, LogOut } from 'lucide-react'
import { signout, setNavigator } from '../api.js'

import { Navigate } from "react-router-dom";
import { useEffect } from 'react'

function ProtectedRoute({ children }) {
	const { me, refreshing } = useAuth();

	if (refreshing) return null;
	if (!me) return <Navigate to="/signin" replace />;

	return children;
}

function App() {
	const navigate = useNavigate()

	useEffect(() => {
		setNavigator(navigate)
	}, [])

	return (
		<div className="flex min-h-screen bg-slate-50">
			{/* Sidebar */}
			<aside className="w-64 bg-white border-r border-slate-200 flex flex-col px-6 py-8">
				<h1 className={`${t.typography.huge} mb-10`}>
					TutorApp
				</h1>

				<nav className="flex flex-col gap-2">
					<button
						onClick={() => navigate('/dashboard')}
						className={`${t.components.button.ghostBase} ${t.components.button.ghostHover} text-left justify-start`}
					>
						<Home className="w-5 h-5" />
						Home
					</button>

					<button
						onClick={() => navigate('/book')}
						className={`${t.components.button.ghostBase} ${t.components.button.ghostHover} text-left justify-start`}
					>
						<Search className="w-5 h-5" />
						Make bookings
					</button>
				</nav>

				{/* Push signout to bottom */}
				<div className="mt-auto pt-6 border-t border-slate-100">
					<button
						onClick={() => signout()}
						className={`${t.components.button.danger} w-full justify-start`}
					>
						<LogOut className="w-5 h-5" />
						Sign out
					</button>
				</div>
			</aside>
			<div className="flex-grow flex items-center justify-center bg-gray-100">
				<Routes>
					<Route path="/signin" element={<SignIn />} />
					<Route path="/register" element={<NewRegister />} />

					<Route
						path="/dashboard"
						element={
							<ProtectedRoute>
								<Dashboard />
							</ProtectedRoute>
						}
					/>
					<Route
						path="/book"
						element={
							<ProtectedRoute>
								<Book />
							</ProtectedRoute>
						}
					/>

					{/* default route */}
					<Route path="/" element={<Navigate to="/dashboard" replace />} />
				</Routes>
			</div>
		</div>)
}

export default App
