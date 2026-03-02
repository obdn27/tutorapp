import { useQuery } from "@tanstack/react-query"
import { lightTheme as t } from "../assets/theme"
import { getBookings } from "../api"

export default function Dashboard() {
	return <div>
		<h1 className={`${t.typography.huge}`}>Welcome back!</h1>
		<p className={`${t.typography.muted}`}>You have sessions scheduled for the next 48 hours</p>
		<SessionsList />
	</div>
}

function Session({ session }) {
	const start = new Date(session.start_ts);
	const end = new Date(session.end_ts);

	const name =
		session.tutor_first_name
			? `${session.tutor_first_name} ${session.tutor_last_name}`
			: session.student_first_name
				? `${session.student_first_name} ${session.student_last_name}`
				: 'Unknown'

	return (
		<div className={`${t.components.card.interactive} p-4 flex items-center gap-4`}>
			{/* time column */}
			<div className="w-20 shrink-0 text-center">
				<div className="text-slate-900 font-bold leading-none">
					{start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
				</div>
				<div className={`${t.typography.muted} leading-none mt-1`}>
					{start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
				</div>
			</div>

			{/* details */}
			<div className="min-w-0 flex-1">
				<div className="text-slate-900 font-bold truncate">
					Session with {name}
				</div>

				<div className={`${t.typography.muted} truncate`}>
					{start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
					{" – "}
					{end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
				</div>

				{session.notes && (
					<div className="text-sm text-slate-500 mt-1 truncate">
						{session.notes}
					</div>
				)}
			</div>

			{/* status badge */}
			<div className="shrink-0 ml-4">
				<span className={`${t.components.badge} bg-slate-100 text-slate-700`}>
					{session.status}
				</span>
			</div>
		</div>
	);
}

function SessionsList() {
	const { data: sessions, isLoading, isError, error } = useQuery({
		queryKey: ['bookings'],
		queryFn: getBookings,
	})

	if (isLoading) return <div>Loading...</div>
	if (isError) return <div>{String(error)}</div>

	return (
		<div className="py-4">
			<h3 className={`${t.typography.heading} py-2`}>
				Upcoming sessions
			</h3>

			{isLoading && <div className={t.typography.muted}>Loading...</div>}

			{!isLoading && sessions.length === 0 && (
				<div className={t.typography.muted}>No sessions yet.</div>
			)}

			{sessions.map((session) => (
				<Session key={session.id} session={session} />
			))}
		</div>
	);
}