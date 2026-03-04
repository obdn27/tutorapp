import { useEffect } from "react";
import { Routes, Route, useNavigate, Navigate, Outlet, useLocation} from "react-router-dom";
import { Home, Search, LogOut, User, CalendarPlus } from "lucide-react";

import { lightTheme as t } from "../assets/theme.js";
import SignIn from "../pages/SignIn.jsx";
import Dashboard from "../pages/Dashboard.jsx";
import NewRegister from "../pages/NewRegister.jsx";
import Tutors from "../pages/Tutors.jsx";
import Profile from "../pages/Profile.jsx";
import Bookings from "../pages/Bookings.jsx";


import { useAuth } from "../Auth.jsx";
import { signout, setNavigator } from "../api.js";


export function ProtectedRoute({children}) {
	const { me, loading } = useAuth();
	const loc = useLocation();

	if (loading) {
		return null;
	} else if (!loading && me) {
		return <>{children}</>
	} else if (!loading & !me) {
		return <Navigate to="/signin" state={{from: loc}} replace />;
	}
}

// function ProtectedRoute({ children }) {
// 	const { me, refreshing } = useAuth();

// 	if (refreshing) {
// 		return (
// 			<div className={`${t.components.container.page} flex items-center justify-center`}>
// 				<div className={t.typography.muted}>Loading…</div>
// 			</div>
// 		);
// 	}

// 	if (!me) return <Navigate to="/signin" replace />;
// 	return children;
// }

function AppShell({ children }) {
	const navigate = useNavigate()
	const { me } = useAuth()

	const showSidebar = Boolean(me)

	return (
		<div className={`${t.components.container.page} min-h-screen`}>
			<div className="min-h-screen flex">
				{showSidebar ? (
					<aside className="w-64 bg-white border-r border-slate-200 flex flex-col px-5 py-6">
						<button
							onClick={() => navigate("/dashboard")}
							className="text-left"
						>
							<div className={t.typography.h3}>TutorApp</div>
							<div className={t.typography.faint}>Bookings & scheduling</div>
						</button>

						<nav className="mt-6 flex flex-col gap-2">
							<button
								onClick={() => navigate("/dashboard")}
								className={`${t.components.nav.link} flex items-center gap-2 justify-start`}
							>
								<Home className="w-5 h-5" />
								Home
							</button>

							<button
								onClick={() => navigate("/book")}
								className={`${t.components.nav.link} flex items-center gap-2 justify-start`}
							>
								<CalendarPlus className="w-5 h-5" />
								Find tutors
							</button>

							<button
								onClick={() => navigate("/profile")}
								className={`${t.components.nav.link} flex items-center gap-2 justify-start`}
							>
								<User className="w-5 h-5" />
								Profile
							</button>

							<button
								onClick={() => navigate("/bookings")}
								className={`${t.components.nav.link} flex items-center gap-2 justify-start`}
							>
								<Search className="w-5 h-5" />
								View bookings
							</button>
						</nav>

						<div className="mt-auto pt-4 border-t border-slate-100">
							<button
								onClick={() => signout()}
								className={`${t.components.button.base} ${t.components.button.dangerSoft} w-full justify-start`}
							>
								<LogOut className="w-5 h-5" />
								Sign out
							</button>
						</div>
					</aside>
				) : null}

				<main className="flex-1 min-w-0 h-screen overflow-y-auto">
					{children}
				</main>
			</div>
		</div>
	);
}

export default function App() {
	const navigate = useNavigate();

	useEffect(() => {
		setNavigator(navigate);
	}, [navigate]);

	return (
		<AppShell>
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
							<Tutors />
						</ProtectedRoute>
					}
				/>
				<Route
					path="/profile"
					element={
						<ProtectedRoute>
							<Profile />
						</ProtectedRoute>
					}
				/>
				<Route
					path="/bookings"
					element={
						<ProtectedRoute>
							<Bookings />
						</ProtectedRoute>
					}
				/>

				{/* default route */}
				<Route path="/" element={<Navigate to="/dashboard" replace />} />
			</Routes>
		</AppShell>
	);
}