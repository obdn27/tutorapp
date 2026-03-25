// src/pages/Dashboard.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lightTheme as t } from "../assets/theme";
import { useAuth } from "../Auth";

import {
	getBookings,
	getTutorMe,
	getMyHours,
	setHours,
	getOffTimes,
	addOffTime,
	deleteOffTime,
	leaveReview,
	patchBookingStatus,
} from "../api";

import {
	Clock,
	CalendarDays,
	Star,
	CalendarClock,
	Plus,
	Trash2,
	User,
	PoundSterling,
	BookOpen,
	X,
	Pencil,
} from "lucide-react";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SECONDS_PER_DAY = 86400;

function btn(variant) {
	return `${t.components.button.base} ${variant}`;
}

function fmtDMY(tsS) {
	const d = new Date((tsS ?? 0) * 1000);
	const dd = String(d.getDate()).padStart(2, "0");
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const yy = String(d.getFullYear()).slice(-2);
	const hh = String(d.getHours()).padStart(2, "0");
	const min = String(d.getMinutes()).padStart(2, "0");
	return `${dd}/${mm}/${yy} ${hh}:${min}`;
}

function fmtS(s) {
	const hh = String(Math.floor(s / 3600)).padStart(2, "0");
	const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
	return `${hh}:${mm}`;
}

function toSeconds(hhmm) {
	const [hh, mm] = hhmm.split(":").map((x) => parseInt(x, 10));
	return hh * 3600 + mm * 60;
}

export default function Dashboard() {
	return (
		<div className={`${t.components.container.page} h-full w-full`}>
			{/* Full width; no max-w clamp */}
			<div className={`w-full px-4 sm:px-6 lg:px-10 py-6 sm:py-8 h-full`}>
				<div className="w-full flex flex-col gap-6 min-h-0">
					<DashboardHeader />
					<DashboardMain />
				</div>
			</div>
		</div>
	);
}

/** ---------------- Header ---------------- */

function DashboardHeader() {
	const { me } = useAuth();
	const navigate = useNavigate();

	const title = me?.first_name ? `Welcome back, ${me.first_name}` : "Welcome back";

	return (
		<div className={`${t.components.card.base} p-5 sm:p-6 flex items-start justify-between gap-4`}>
			<div className="min-w-0">
				<h1 className={`${t.typography.huge}`}>{title}</h1>
			</div>

			<div className="flex gap-2 shrink-0">
				<button className={btn(t.components.button.primary)} onClick={() => navigate("/book")}>Book session</button>
			</div>
		</div>
	);
}

/** ---------------- Main ---------------- */

function DashboardMain() {
	const { me } = useAuth();
	const qc = useQueryClient();

	const bookingsQ = useQuery({ queryKey: ["bookings"], queryFn: getBookings });
	const bookings = bookingsQ.data ?? [];

	const patchedRef = useRef(new Set());

	// Modal state
	const [activeBooking, setActiveBooking] = useState(null);

	const patchMut = useMutation({
		mutationFn: ({ booking_id, status }) => patchBookingStatus({ booking_id, status }),
		onSuccess: async () => {
			await qc.invalidateQueries({ queryKey: ["bookings"] });
		},
	});

	// Auto-update status for past sessions:
	// - confirmed + past => completed
	// - requested + past => rejected
	const autoTouchedRef = useRef(new Set());
	useEffect(() => {
		if (!me) return;
		if (me.role !== 1) return;
		if (!Array.isArray(bookingsQ.data)) return;

		const nowS = Math.floor(Date.now() / 1000);
		const bookings = bookingsQ.data;

		const toPatch = [];

		for (const b of bookings) {
			if (!b?.id) continue;
			if (patchedRef.current.has(b.id)) continue;

			const isPast = b.end_ts <= nowS;

			if (isPast && b.status === "confirmed") {
				toPatch.push({ id: b.id, status: "completed" });
			}

			if (isPast && b.status === "requested") {
				toPatch.push({ id: b.id, status: "rejected" });
			}
		}

		if (toPatch.length === 0) return;

		toPatch.forEach(x => patchedRef.current.add(x.id));

		(async () => {
			for (const x of toPatch) {
				try {
					await patchBookingStatus(x.id, x.status);
				} catch (e) {
					patchedRef.current.delete(x.id);
				}
			}
		})();

	}, [me?.role, bookingsQ.data]);

	const next48 = useMemo(() => computeNext48(bookings), [bookings]);
	const board = useMemo(() => splitBoard4(bookings), [bookings]);

	return (
		<>
			<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
				{/* LEFT */}
				<div className="lg:col-span-4 flex flex-col gap-6 min-h-0">
					<Next48Card q={bookingsQ} stats={next48} />

					{me?.role === 1 ? (
						<>
							<TutorMiniProfile />
						</>
					) : (
						<StudentHint />
					)}
				</div>

				{/* RIGHT */}
				<div className="lg:col-span-8 min-h-0">
					<AvailabilityManager />

				</div>
			</div>

			{activeBooking ? (
				<BookingStatusModal
					booking={activeBooking}
					onClose={() => setActiveBooking(null)}
					onPatch={(status) =>
						patchMut.mutate(
							{ booking_id: activeBooking.id, status },
							{ onSuccess: () => setActiveBooking(null) }
						)
					}
					isPatching={patchMut.isPending}
					patchError={patchMut.isError ? patchMut.error : null}
				/>
			) : null}
		</>
	);
}

/** ---------------- Next 48h ---------------- */

function computeNext48(bookings) {
	const nowMs = Date.now();
	const endMs = nowMs + 48 * 3600 * 1000;

	const upcoming = bookings
		.filter((b) => {
			const startMs = (b.start_ts ?? 0) * 1000;
			const active = b.status === "requested" || b.status === "confirmed";
			return active && startMs >= nowMs && startMs <= endMs;
		})
		.sort((a, b) => (a.start_ts ?? 0) - (b.start_ts ?? 0));

	return { count: upcoming.length, next: upcoming[0] ?? null };
}

function Next48Card({ q, stats }) {
	return (
		<div className={`${t.components.card.base} p-5 sm:p-6`}>
			<div className="flex items-start justify-between gap-3">
				<div>
					<div className={`${t.typography.heading} flex items-center gap-2`}>
						<Clock className="w-4 h-4 text-slate-400" />
						Next 48 hours
					</div>
					<div className={t.typography.muted}>{q.isLoading ? "Loading…" : `${stats.count} session(s)`}</div>
				</div>
				<span className={`${t.components.badge.base} ${t.components.badge.neutral}`}>48h</span>
			</div>

			<div className="mt-4">
				{q.isLoading ? (
					<div className={t.typography.muted}>Fetching sessions…</div>
				) : q.isError ? (
					<div className={`${t.components.alert.base} ${t.components.alert.error}`}>Failed to load: {String(q.error)}</div>
				) : stats.next ? (
					<NextSessionMini booking={stats.next} />
				) : (
					<div className={t.typography.muted}>No sessions in the next 48 hours.</div>
				)}
			</div>
		</div>
	);
}

function NextSessionMini({ booking }) {
	const start = new Date((booking.start_ts ?? 0) * 1000);
	const end = new Date((booking.end_ts ?? 0) * 1000);

	const who = booking.tutor_first_name
		? `${booking.tutor_first_name} ${booking.tutor_last_name}`
		: booking.student_first_name
			? `${booking.student_first_name} ${booking.student_last_name}`
			: "Unknown";

	return (
		<div className={`${t.components.card.subtle} p-4`}>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="font-bold">{who}</div>
					<div className={t.typography.muted}>
						{start.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
						{" · "}
						{start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
						{" – "}
						{end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
					</div>
				</div>
				<span className={`${t.components.badge.base} ${t.components.badge.neutral}`}>{booking.status}</span>
			</div>
		</div>
	);
}

/** ---------------- Board (4 columns) ---------------- */

function splitBoard4(bookings) {
	const nowS = Math.floor(Date.now() / 1000);

	const requested = [];
	const confirmed = [];
	const rejectedCanceled = [];
	const completed = [];

	for (const b of bookings) {
		const endS = Number(b.end_ts ?? 0);
		const isPast = endS > 0 && endS < nowS;

		if (b.status === "completed" && isPast) {
			completed.push(b);
			continue;
		}

		if (b.status === "requested" && !isPast) requested.push(b);
		if (b.status === "confirmed" && !isPast) confirmed.push(b);
		if (b.status === "rejected" || b.status === "canceled") rejectedCanceled.push(b);
	}

	requested.sort((a, b) => (a.start_ts ?? 0) - (b.start_ts ?? 0));
	confirmed.sort((a, b) => (a.start_ts ?? 0) - (b.start_ts ?? 0));
	rejectedCanceled.sort((a, b) => (b.start_ts ?? 0) - (a.start_ts ?? 0));
	completed.sort((a, b) => (b.start_ts ?? 0) - (a.start_ts ?? 0));

	return { requested, confirmed, rejectedCanceled, completed };
}

/** ---------------- Tutor mini profile ---------------- */

function TutorMiniProfile() {
	const { me } = useAuth();
	const navigate = useNavigate();

	const q = useQuery({
		queryKey: ["tutorMe"],
		queryFn: getTutorMe,
		enabled: me?.role === 1,
	});

	if (me?.role !== 1) return null;

	return (
		<div className={`${t.components.card.base} p-5 sm:p-6`}>
			<div className="flex items-start justify-between gap-3">
				<div>
					<div className={`${t.typography.heading} flex items-center gap-2`}>
						<User className="w-4 h-4 text-slate-400" />
						Tutor profile
					</div>
					<div className={t.typography.muted}>Quick view + edit.</div>
				</div>

				<button
					className={`${t.components.button.icon} ${t.components.button.iconSm}`}
					onClick={() => navigate("/profile?edit=1")}
					title="Edit profile"
				>
					<Pencil className="w-4 h-4 text-slate-500" />
				</button>
			</div>

			<div className="mt-4">
				{q.isLoading ? (
					<div className={t.typography.muted}>Loading…</div>
				) : q.isError ? (
					<div className={`${t.components.alert.base} ${t.components.alert.error}`}>Failed to load tutor profile.</div>
				) : (
					<TutorMini tutor={q.data} me={me} />
				)}
			</div>
		</div>
	);
}

function TutorMini({ tutor, me }) {
	const subjects = Array.isArray(tutor?.subjects) ? tutor.subjects : [];
	const hourly = tutor?.hourly_gbp ?? "-";
	const rating = tutor?.no_ratings > 0 ? (tutor.rating_sum / tutor.no_ratings).toFixed(1) : "—";
	const fullName = me?.first_name && me?.last_name ? `${me.first_name} ${me.last_name}` : "";

	return (
		<div className="flex flex-col gap-3">
			<div className="font-bold text-slate-900">{fullName}</div>

			<div className="flex flex-wrap gap-2">
				<span className={`${t.components.badge.base} ${t.components.badge.neutral} inline-flex items-center gap-1.5`}>
					<PoundSterling className="w-4 h-4 text-slate-400" /> £{hourly}/hr
				</span>
				<span className={`${t.components.badge.base} ${t.components.badge.neutral} inline-flex items-center gap-1.5`}>
					<Star className="w-4 h-4 text-slate-400" /> {rating}
				</span>
				<span className={`${t.components.badge.base} ${t.components.badge.neutral} inline-flex items-center gap-1.5`}>
					<BookOpen className="w-4 h-4 text-slate-400" /> {subjects.length}
				</span>
			</div>

			{tutor?.bio ? (
				<div className={`${t.components.card.muted} p-3`}>
					<div className={t.typography.faint}>Bio</div>
					<div className="mt-1 text-sm text-slate-700">{tutor.bio}</div>
				</div>
			) : (
				<div className={`${t.components.alert.base} ${t.components.alert.warning}`}>Add a bio so students trust you more.</div>
			)}

			{subjects.length ? (
				<div className="flex flex-wrap gap-2">
					{subjects.slice(0, 8).map((s) => (
						<span key={s} className={`${t.components.badge.base} ${t.components.badge.brand}`}>{s}</span>
					))}
					{subjects.length > 8 ? <span className={`${t.components.badge.base} ${t.components.badge.neutral}`}>+{subjects.length - 8}</span> : null}
				</div>
			) : (
				<div className={`${t.components.alert.base} ${t.components.alert.warning}`}>No subjects set.</div>
			)}
		</div>
	);
}

/** ---------------- Availability manager (Time off first, editable hours tiles) ---------------- */

function AvailabilityManager() {
	const { me } = useAuth();
	const qc = useQueryClient();

	if (me?.role !== 1) return null;

	const nowS = Math.floor(Date.now() / 1000);
	const windowStartS = nowS - 7 * 86400;
	const windowEndS = nowS + 60 * 86400;

	const offQ = useQuery({
		queryKey: ["offTimes", windowStartS, windowEndS],
		queryFn: () => getOffTimes({ start_ts: windowStartS, end_ts: windowEndS }),
	});

	const hoursQ = useQuery({ queryKey: ["hours"], queryFn: getMyHours });

	const setHoursMut = useMutation({
		mutationFn: (payload) => setHours(payload),
		onSuccess: async () => qc.invalidateQueries({ queryKey: ["hours"] }),
	});

	const addOffMut = useMutation({
		mutationFn: (payload) => addOffTime(payload),
		onSuccess: async () => qc.invalidateQueries({ queryKey: ["offTimes"] }),
	});

	const delOffMut = useMutation({
		mutationFn: (id) => deleteOffTime(id),
		onSuccess: async () => qc.invalidateQueries({ queryKey: ["offTimes"] }),
	});

	return (
		<div className={`${t.components.card.base} p-5 sm:p-6`}>
			<div className="flex items-start justify-between gap-3">
				<div>
					<div className={`${t.typography.heading} flex items-center gap-2`}>
						<CalendarClock className="w-4 h-4 text-slate-400" />
						Availability
					</div>
					<div className={t.typography.muted}>Time off + weekly hours.</div>
				</div>
			</div>

			<div className="mt-5 grid grid-cols-1 gap-6">
				<TimeOffEditor
					q={offQ}
					onAdd={(payload) => addOffMut.mutate(payload)}
					adding={addOffMut.isPending}
					addError={addOffMut.isError ? addOffMut.error : null}
					onDelete={(id) => delOffMut.mutate(id)}
					deleting={delOffMut.isPending}
				/>

				<WeeklyHoursTiles
					q={hoursQ}
					onUpsert={(payload) => setHoursMut.mutate(payload)}
					saving={setHoursMut.isPending}
					error={setHoursMut.isError ? setHoursMut.error : null}
				/>
			</div>
		</div>
	);
}

function TimeOffEditor({ q, onAdd, adding, addError, onDelete, deleting }) {
	const [startLocal, setStartLocal] = useState("");
	const [endLocal, setEndLocal] = useState("");

	function toEpochSeconds(local) {
		if (!local) return null;
		const ms = new Date(local).getTime();
		if (!Number.isFinite(ms)) return null;
		return Math.floor(ms / 1000);
	}

	const items = q.data ?? [];

	return (
		<div className={`${t.components.card.subtle} p-4`}>
			<div className="flex items-start justify-between gap-3">
				<div>
					<div className={`${t.typography.heading} flex items-center gap-2`}>
						<CalendarDays className="w-4 h-4 text-slate-400" />
						Time off
					</div>
					<div className={t.typography.muted}>Block specific ranges.</div>
				</div>
			</div>

			<div className="mt-4 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
				<div className="sm:col-span-2">
					<label className={t.components.input.label}>Start</label>
					<input type="datetime-local" className={t.components.input.base} value={startLocal} onChange={(e) => setStartLocal(e.target.value)} />
				</div>

				<div className="sm:col-span-2">
					<label className={t.components.input.label}>End</label>
					<input type="datetime-local" className={t.components.input.base} value={endLocal} onChange={(e) => setEndLocal(e.target.value)} />
				</div>

				<button
					className={btn(t.components.button.secondary)}
					disabled={adding}
					onClick={() => {
						const start_ts = toEpochSeconds(startLocal);
						const end_ts = toEpochSeconds(endLocal);
						if (!start_ts || !end_ts || end_ts <= start_ts) return;
						onAdd({ start_ts, end_ts });
						setStartLocal("");
						setEndLocal("");
					}}
				>
					<Plus className="w-4 h-4" />
					{adding ? "Adding…" : "Add"}
				</button>
			</div>

			{addError ? <div className={`${t.components.alert.base} ${t.components.alert.error} mt-4`}>Failed: {String(addError)}</div> : null}

			<div className="mt-4">
				{q.isLoading ? (
					<div className={t.typography.muted}>Loading time off…</div>
				) : q.isError ? (
					<div className={`${t.components.alert.base} ${t.components.alert.error}`}>Failed to load time off.</div>
				) : items.length === 0 ? (
					<div className={t.typography.muted}>No time off set.</div>
				) : (
					<div className="flex flex-col gap-2">
						{items.map((x) => (
							<div key={x.id} className={`${t.components.card.muted} p-3 flex items-center justify-between gap-3`}>
								<div className="min-w-0">
									<div className="font-semibold text-slate-800">{fmtDMY(x.start_ts)}</div>
									<div className={t.typography.muted}>to {fmtDMY(x.end_ts)}</div>
								</div>
								<button
									className={`${t.components.button.icon} ${t.components.button.iconSm} disabled:opacity-50`}
									disabled={deleting}
									onClick={() => onDelete(x.id)}
									title="Delete"
								>
									<Trash2 className="w-4 h-4 text-slate-500" />
								</button>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

function WeeklyHoursTiles({ q, onUpsert, saving, error }) {
	const hours = q.data ?? [];
	const byWeekday = useMemo(() => {
		const m = new Map();
		for (const row of hours) m.set(row.weekday, row);
		return m;
	}, [hours]);

	const [editingDay, setEditingDay] = useState(null); // weekday int
	const [start, setStart] = useState("09:00");
	const [end, setEnd] = useState("17:00");

	useEffect(() => {
		if (editingDay === null) return;
		const row = byWeekday.get(editingDay);
		if (row) {
			setStart(fmtS(row.start_s));
			setEnd(fmtS(row.end_s));
		} else {
			setStart("09:00");
			setEnd("17:00");
		}
	}, [editingDay, byWeekday]);

	return (
		<div className={`${t.components.card.subtle} p-4`}>
			<div className="flex items-start justify-between gap-3">
				<div>
					<div className={`${t.typography.heading} flex items-center gap-2`}>
						<CalendarDays className="w-4 h-4 text-slate-400" />
						Weekly working hours
					</div>
					<div className={t.typography.muted}>Click a day to edit.</div>
				</div>
				<span className={`${t.components.badge.base} ${t.components.badge.neutral}`}>{hours.length}/7 set</span>
			</div>

			{q.isLoading ? (
				<div className={`${t.typography.muted} mt-4`}>Loading hours…</div>
			) : q.isError ? (
				<div className={`${t.components.alert.base} ${t.components.alert.error} mt-4`}>Failed to load hours.</div>
			) : (
				<div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
					{WEEKDAYS.map((d, i) => {
						const row = byWeekday.get(i);
						return (
							<button
								key={d}
								type="button"
								onClick={() => setEditingDay(i)}
								className={`${t.components.card.muted} p-3 flex items-center justify-between text-left hover:bg-slate-100 ${t.tokens.transition.base}`}
							>
								<div className="font-semibold text-slate-800">{d}</div>
								<div className={t.typography.muted}>{row ? `${fmtS(row.start_s)}–${fmtS(row.end_s)}` : "Not set"}</div>
							</button>
						);
					})}
				</div>
			)}

			{error ? <div className={`${t.components.alert.base} ${t.components.alert.error} mt-4`}>Failed to set hours: {String(error)}</div> : null}

			{editingDay !== null ? (
				<div className="mt-4 border-t border-slate-100 pt-4">
					<div className="flex items-start justify-between gap-3">
						<div>
							<div className="font-bold text-slate-900">Edit {WEEKDAYS[editingDay]}</div>
							<div className={t.typography.muted}>Change start/end then save.</div>
						</div>
						<button className={`${t.components.button.icon} ${t.components.button.iconSm}`} onClick={() => setEditingDay(null)} title="Close">
							<X className="w-4 h-4 text-slate-500" />
						</button>
					</div>

					<div className="mt-3 grid grid-cols-2 gap-3">
						<div>
							<label className={t.components.input.label}>Start</label>
							<input type="time" className={t.components.input.base} value={start} onChange={(e) => setStart(e.target.value)} />
						</div>
						<div>
							<label className={t.components.input.label}>End</label>
							<input type="time" className={t.components.input.base} value={end} onChange={(e) => setEnd(e.target.value)} />
						</div>
					</div>

					<div className="mt-3 flex items-center justify-end gap-2">
						<button className={btn(t.components.button.neutral)} onClick={() => setEditingDay(null)}>Cancel</button>
						<button
							className={btn(t.components.button.primary)}
							disabled={saving}
							onClick={() => {
								const start_s = toSeconds(start);
								const end_s = toSeconds(end);
								if (start_s < 0 || end_s <= 0 || end_s > SECONDS_PER_DAY || end_s <= start_s) return;
								onUpsert({ weekday: editingDay, start_s, end_s });
								setEditingDay(null);
							}}
						>
							{saving ? "Saving…" : "Save"}
						</button>
					</div>
				</div>
			) : null}
		</div>
	);
}

function StudentHint() {
	const navigate = useNavigate();
	return (
		<div className={`${t.components.card.base} p-5 sm:p-6`}>
			<div className={`${t.typography.heading} flex items-center gap-2`}>
				<CalendarDays className="w-4 h-4 text-slate-400" />
				Book a tutor
			</div>
			<div className={`${t.typography.muted} mt-1`}>Go to the booking page to view tutor availability and request a session.</div>
			<button className={`${btn(t.components.button.primary)} mt-4`} onClick={() => navigate("/book")}>Book</button>
		</div>
	);
}
