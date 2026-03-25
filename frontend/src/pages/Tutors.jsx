import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lightTheme as t } from "../assets/theme";
import { useAuth } from "../Auth";
import {
	getTutors,
	getTutorAvailability,
	getBookings,
	canBook,
	createBooking,
} from "../api";
import { CalendarDays, ChevronLeft, ChevronRight, Search, User } from "lucide-react";

// ---- constants
const SLOT_S = 30 * 60;         // 30 min
const WINDOW_DAYS = 7;          // 1 week per page
const MAX_LOOKAHEAD_DAYS = 30;  // allow paging up to 30 days ahead
const DAY_START_HOUR = 7;       // display grid from 07:00
const DAY_END_HOUR = 21;        // to 21:00

export default function Tutors() {
	const { me } = useAuth();
	const qc = useQueryClient();

	const [selectedTutor, setSelectedTutor] = useState(null);
	const [query, setQuery] = useState("");
	const [selectedSlot, setSelectedSlot] = useState(null); // { start_ts, end_ts }
	const [notes, setNotes] = useState("");

	// week paging
	const [weekOffset, setWeekOffset] = useState(0);

	// students only
	const isStudent = me?.role === 0;

	// tutors list
	const tutorsQ = useQuery({
		queryKey: ["tutors"],
		queryFn: getTutors,
	});

	// my bookings (needed to disable slots that clash for the student)
	const myBookingsQ = useQuery({
		queryKey: ["bookings"],
		queryFn: getBookings,
		enabled: !!me,
	});

	// window calculation
	const nowS = Math.floor(Date.now() / 1000);
	const baseStart = startOfDayUtc(nowS + 86400); // start tomorrow (keeps UI sane)
	const windowStartS = baseStart + weekOffset * WINDOW_DAYS * 86400;
	const windowEndS = windowStartS + WINDOW_DAYS * 86400;

	// tutor availability
	const availabilityQ = useQuery({
		queryKey: ["availability", selectedTutor?.id, windowStartS, windowEndS, SLOT_S],
		enabled: !!selectedTutor?.id,
		queryFn: () =>
			getTutorAvailability({
				tutorId: selectedTutor.id,
				startTs: windowStartS,
				endTs: windowEndS,
				slotS: SLOT_S,
			}),
	});

	// filtered tutors
	const tutors = tutorsQ.data ?? [];
	const filteredTutors = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return tutors;
		return tutors.filter((tt) => {
			const name = `${tt.first_name ?? ""} ${tt.last_name ?? ""}`.toLowerCase();
			const email = (tt.email ?? "").toLowerCase();
			const subjects = Array.isArray(tt.subjects) ? tt.subjects.join(" ").toLowerCase() : "";
			return name.includes(q) || email.includes(q) || subjects.includes(q);
		});
	}, [tutors, query]);

	// build "my busy intervals" so we can disable overlapping slots
	const myBusy = useMemo(() => {
		const rows = myBookingsQ.data ?? [];
		// only active bookings should block booking a new slot
		const active = rows.filter((b) => b.status === "requested" || b.status === "confirmed");
		return active.map((b) => ({
			start_ts: Number(b.start_ts),
			end_ts: Number(b.end_ts),
		}));
	}, [myBookingsQ.data]);

	// slots by day, with an added "blockedByMe" flag
	const slotsByDay = useMemo(() => {
		const intervals = availabilityQ.data?.intervals ?? [];
		const out = buildSlotsFromIntervals(intervals, SLOT_S, {
			windowStartS,
			windowEndS,
			dayStartHour: DAY_START_HOUR,
			dayEndHour: DAY_END_HOUR,
		});

		// mark blocked slots
		for (const dayKey of Object.keys(out)) {
			out[dayKey] = out[dayKey].map((slot) => ({
				...slot,
				blockedByMe: overlapsAny(slot, myBusy),
			}));
		}

		return out;
	}, [availabilityQ.data, windowStartS, windowEndS, myBusy]);

	// clear notes when switching tutor / slot (prevents cross contamination)
	useEffect(() => {
		setNotes("");
	}, [selectedTutor?.id, selectedSlot?.start_ts]);

	const submitMut = useMutation({
		mutationFn: async ({ tutor_id, start_ts, end_ts, notes }) => {
			const check = await canBook({ tutor_id, start_ts, end_ts });
			if (!check.ok) {
				const err = new Error(check.reason || "cannot_book");
				err.code = check.reason;
				throw err;
			}
			return createBooking({ tutor_id, start_ts, end_ts, notes });
		},
		onSuccess: async () => {
			await qc.invalidateQueries({ queryKey: ["bookings"] });
			await qc.invalidateQueries({ queryKey: ["availability"] });
			setSelectedSlot(null);
			setNotes("");
		},
	});

	const maxWeekOffset = Math.floor(MAX_LOOKAHEAD_DAYS / WINDOW_DAYS);
	const canPrev = weekOffset > 0;
	const canNext = weekOffset < maxWeekOffset;

	return (
		<main className={`${t.components.container.page} h-screen w-full overflow-hidden`}>
			{/* full width container (NOT max-w-6xl) */}
			<div className="h-full w-full px-4 sm:px-6 lg:px-8 py-6 min-h-0">
				<div className="h-full min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-6">
					{/* 1) Tutor viewer */}
					<div className="h-full min-h-0">
						<TutorSearch
							query={query}
							setQuery={setQuery}
							tutorsQ={tutorsQ}
							tutors={filteredTutors}
							selectedTutor={selectedTutor}
							onPickTutor={(tt) => {
								setSelectedTutor(tt);
								setSelectedSlot(null);
							}}
						/>
					</div>

					{/* 2) Availability viewer */}
					<div className="h-full min-h-0">
						<AvailabilityViewer
							tutor={selectedTutor}
							isStudent={isStudent}
							availabilityQ={availabilityQ}
							slotsByDay={slotsByDay}
							selectedSlot={selectedSlot}
							onPickSlot={(slot) => setSelectedSlot(slot)}
							weekOffset={weekOffset}
							onPrev={() => canPrev && setWeekOffset((x) => x - 1)}
							onNext={() => canNext && setWeekOffset((x) => x + 1)}
							canPrev={canPrev}
							canNext={canNext}
						/>
					</div>

					{/* 3) Request booking */}
					<div className="h-full min-h-0">
						<RequestBook
							me={me}
							isStudent={isStudent}
							tutor={selectedTutor}
							slot={selectedSlot}
							notes={notes}
							setNotes={setNotes}
							isSubmitting={submitMut.isPending}
							submitError={submitMut.error}
							onClearSlot={() => setSelectedSlot(null)}
							onSubmit={() => {
								if (!isStudent) return;
								if (!selectedTutor || !selectedSlot) return;
								submitMut.mutate({
									tutor_id: selectedTutor.id,
									start_ts: selectedSlot.start_ts,
									end_ts: selectedSlot.end_ts,
									notes: notes || "",
								});
							}}
						/>
					</div>
				</div>
			</div>
		</main>
	);
}

/* ---------------- Components ---------------- */

function TutorSearch({ query, setQuery, tutorsQ, tutors, selectedTutor, onPickTutor }) {
	return (
		<div className={`${t.components.card.base} h-full min-h-0 flex flex-col`}>
			<div className="p-5 sm:p-6 border-b border-slate-100">
				<div className="flex items-center justify-between gap-3">
					<h2 className={t.typography.h3}>Tutors</h2>
					<span className={`${t.components.badge.base} ${t.components.badge.brand}`}>{tutors.length}</span>
				</div>

				<div className="mt-4 relative">
					<Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
					<input
						className={`${t.components.input.soft} pl-10`}
						placeholder="Search by name, subject, email…"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
					/>
				</div>
			</div>

			{/* scroll area */}
			<div className="p-3 sm:p-4 flex-1 min-h-0 overflow-y-auto">
				{tutorsQ.isLoading ? (
					<div className={t.typography.muted}>Loading tutors…</div>
				) : tutorsQ.isError ? (
					<div className={`${t.components.alert.base} ${t.components.alert.error}`}>Failed to load tutors.</div>
				) : tutors.length === 0 ? (
					<div className={t.typography.muted}>No tutors match your search.</div>
				) : (
					<div className="flex flex-col gap-2 pr-1">
						{tutors.map((tt) => (
							<TutorRow
								key={tt.id}
								tutor={tt}
								selected={selectedTutor?.id === tt.id}
								onSelect={() => onPickTutor(tt)}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

function TutorRow({ tutor, selected, onSelect }) {
	const fullName = `${tutor.first_name ?? ""} ${tutor.last_name ?? ""}`.trim() || "Unnamed tutor";
	const subjects = Array.isArray(tutor.subjects) ? tutor.subjects : [];
	const avg = tutor.no_ratings && tutor.no_ratings > 0 ? tutor.rating_sum / tutor.no_ratings : null;

	const cls = selected ? t.components.nav.linkActive : t.components.nav.link;

	return (
		<button onClick={onSelect} className={`${cls} w-full text-left`}>
			<div className="flex items-start gap-3">
				<User className="w-4 h-4 text-slate-400 mt-0.5" />
				<div className="min-w-0 flex-1">
					<div className="font-semibold text-slate-900 truncate">{fullName}</div>
					<div className={t.typography.faint}>
						£{tutor.hourly_gbp ?? "-"} / hr · {avg === null ? "—" : avg.toFixed(1)} ({tutor.no_ratings ?? 0})
					</div>

					{subjects.length ? (
						<div className="mt-2 flex flex-wrap gap-2">
							{subjects.slice(0, 4).map((s) => (
								<span key={s} className={`${t.components.badge.base} ${t.components.badge.neutral}`}>
									{s}
								</span>
							))}
							{subjects.length > 4 ? (
								<span className={`${t.components.badge.base} ${t.components.badge.neutral}`}>
									+{subjects.length - 4}
								</span>
							) : null}
						</div>
					) : null}
				</div>
			</div>
		</button>
	);
}

function AvailabilityViewer({
	tutor,
	isStudent,
	availabilityQ,
	slotsByDay,
	selectedSlot,
	onPickSlot,
	weekOffset,
	onPrev,
	onNext,
	canPrev,
	canNext,
}) {
	const days = Object.keys(slotsByDay).map(Number).sort((a, b) => a - b);

	return (
		<div className={`${t.components.card.base} h-full min-h-0 flex flex-col`}>
			<div className="p-5 sm:p-6 border-b border-slate-100">
				<div className="flex items-start justify-between gap-3">
					<div>
						<h2 className={t.typography.h3}>Availability</h2>
						<div className={t.typography.muted}>
							{!tutor
								? "Select a tutor to view available slots."
								: isStudent
									? `Pick a slot for ${tutor.first_name} ${tutor.last_name}`
									: "Tutors cannot make bookings (student-only)."}
						</div>
					</div>

					<div className="flex items-center gap-2 shrink-0 flex-nowrap">
						<button
							className={`${t.components.button.icon} h-9 w-9 rounded-lg bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 hover:text-indigo-800`}
							onClick={onPrev}
							disabled={!canPrev}
							aria-label="Previous week"
							title="Previous week"
						>
							<ChevronLeft className="h-4 w-4 stroke-[2.5]" />
						</button>
						<span className="inline-flex h-9 items-center whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
							Week {weekOffset + 1}
						</span>
						<button
							className={`${t.components.button.icon} h-9 w-9 rounded-lg bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 hover:text-indigo-800`}
							onClick={onNext}
							disabled={!canNext}
							aria-label="Next week"
							title="Next week"
						>
							<ChevronRight className="h-4 w-4 stroke-[2.5]" />
						</button>
					</div>
				</div>
			</div>

			{/* scroll area */}
			<div className="p-5 sm:p-6 flex-1 min-h-0 overflow-y-auto">
				{!tutor ? (
					<EmptyState
						icon={<CalendarDays className="w-5 h-5" />}
						title="No tutor selected"
						body="Choose a tutor from the left to see their availability."
					/>
				) : availabilityQ.isLoading ? (
					<div className={t.typography.muted}>Loading availability…</div>
				) : availabilityQ.isError ? (
					<div className={`${t.components.alert.base} ${t.components.alert.error}`}>Failed to load availability.</div>
				) : days.length === 0 ? (
					<div className={t.typography.muted}>No availability in this window.</div>
				) : (
					<div className="flex flex-col gap-4">
						{days.map((dayStartTs) => {
							const daySlots = slotsByDay[dayStartTs];
							const d = new Date(dayStartTs * 1000);

							return (
								<div key={dayStartTs} className={t.components.card.subtle}>
									<div className="p-3 border-b border-slate-100 flex items-center justify-between">
										<div className="font-semibold text-slate-900">
											{d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
										</div>
										<div className={t.typography.faint}>{daySlots.length} slots</div>
									</div>

									<div className="p-3">
										<div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
											{daySlots.map((slot) => {
												const label = new Date(slot.start_ts * 1000).toLocaleTimeString("en-GB", {
													hour: "2-digit",
													minute: "2-digit",
												});

												const isSelected =
													selectedSlot &&
													selectedSlot.start_ts === slot.start_ts &&
													selectedSlot.end_ts === slot.end_ts;

												const disabled = !!slot.blockedByMe || !isStudent;

												const baseCls = isSelected ? t.components.nav.linkActive : t.components.nav.link;

												return (
													<button
														key={slot.start_ts}
														disabled={disabled}
														onClick={() => {
															if (disabled) return;
															onPickSlot(slot);
														}}
														className={[
															baseCls,
															"justify-center",
															disabled ? "opacity-40 cursor-not-allowed" : "",
														].join(" ")}
														title={
															!isStudent
																? "Student-only"
																: slot.blockedByMe
																	? "You already have a booking that overlaps"
																	: ""
														}
													>
														{label}
													</button>
												);
											})}
										</div>

										{/* tiny legend */}
										<div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
											<span className="inline-block h-2 w-2 rounded-full bg-slate-300" />
											Disabled = clashes with your existing booking
										</div>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}

function RequestBook({
	me,
	isStudent,
	tutor,
	slot,
	notes,
	setNotes,
	isSubmitting,
	submitError,
	onClearSlot,
	onSubmit,
}) {
	const canSubmit = Boolean(isStudent && tutor && slot && !isSubmitting);

	const slotText = useMemo(() => {
		if (!slot) return null;
		const s = new Date(slot.start_ts * 1000);
		const e = new Date(slot.end_ts * 1000);
		return `${s.toLocaleDateString("en-GB", {
			weekday: "short",
			day: "numeric",
			month: "short",
		})} · ${s.toLocaleTimeString("en-GB", {
			hour: "2-digit",
			minute: "2-digit",
		})} – ${e.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
	}, [slot]);

	const errorMsg = submitError
		? String(submitError.code || submitError.message || submitError)
		: null;

	const tutorFullName = tutor
		? `${tutor.first_name ?? ""} ${tutor.last_name ?? ""}`.trim()
		: "";

	const subjects = tutor && Array.isArray(tutor.subjects) ? tutor.subjects : [];

	const avg =
		tutor && tutor.no_ratings && tutor.no_ratings > 0
			? tutor.rating_sum / tutor.no_ratings
			: null;

	return (
		<div className={`${t.components.card.base} h-full min-h-0 flex flex-col`}>
			<div className="p-5 sm:p-6 border-b border-slate-100">
				<h2 className={t.typography.h3}>Request booking</h2>
				<div className={t.typography.muted}>
					{!isStudent
						? "This page is for students. Tutors manage sessions from the dashboard."
						: tutor
							? "Review tutor details, pick a slot, then send the request."
							: "Select a tutor first."}
				</div>
			</div>

			<div className="p-5 sm:p-6 flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto">
				{/* Tutor profile */}
				{!tutor ? (
					<div className={t.components.card.muted}>
						<div className="p-4">
							<div className="font-semibold text-slate-900">No tutor selected</div>
							<div className={t.typography.muted}>Pick a tutor to view their profile here.</div>
						</div>
					</div>
				) : (
					<div className={t.components.card.muted}>
						<div className="p-4">
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0">
									<div className="font-semibold text-slate-900 truncate">
										{tutorFullName || "Unnamed tutor"}
									</div>
									<div className={t.typography.muted + " truncate"}>
										{tutor.email ?? "—"}
									</div>
								</div>

								<span className={`${t.components.badge.base} ${t.components.badge.brand} shrink-0`}>
									£{tutor.hourly_gbp ?? "—"}/hr
								</span>
							</div>

							<div className="mt-3 flex items-center gap-2">
								<span className={`${t.components.badge.base} ${t.components.badge.neutral}`}>
									Rating: {avg === null ? "—" : avg.toFixed(1)}
								</span>
								<span className={`${t.components.badge.base} ${t.components.badge.neutral}`}>
									({tutor.no_ratings ?? 0})
								</span>
							</div>

							{subjects.length > 0 ? (
								<div className="mt-3 flex flex-wrap gap-2">
									{subjects.map((s) => (
										<span key={s} className={`${t.components.badge.base} ${t.components.badge.neutral}`}>
											{s}
										</span>
									))}
								</div>
							) : (
								<div className={`${t.typography.faint} mt-3`}>No subjects listed.</div>
							)}

							<div className="mt-4">
								<div className={t.components.input.label}>Bio</div>
								<div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
									{tutor.bio?.trim() ? tutor.bio : "No bio provided."}
								</div>
							</div>
						</div>
					</div>
				)}

				{/* Selected slot */}
				<div className={t.components.card.muted}>
					<div className="p-4">
						<div className="font-semibold text-slate-900">
							{slotText ? "Selected time" : "No time selected"}
						</div>
						<div className={t.typography.muted}>{slotText ?? "Pick a slot from Availability."}</div>

						{slot ? (
							<button
								onClick={onClearSlot}
								className={`${t.components.button.base} ${t.components.button.ghost} ${t.components.button.sm} mt-3 w-full`}
							>
								Clear selected time
							</button>
						) : null}
					</div>
				</div>

				{/* Notes */}
				<div>
					<label className={t.components.input.label}>Notes (optional)</label>
					<textarea
						rows={5}
						className={t.components.input.soft}
						placeholder="Anything the tutor should know…"
						value={notes}
						onChange={(e) => setNotes(e.target.value)}
						disabled={!isStudent}
					/>
				</div>

				{/* Error */}
				{errorMsg ? (
					<div className={`${t.components.alert.base} ${t.components.alert.error}`}>
						{errorMsg}
					</div>
				) : null}

				{/* Submit */}
				<button
					disabled={!canSubmit}
					onClick={onSubmit}
					className={`${t.components.button.base} ${t.components.button.primary} w-full`}
				>
					{isSubmitting ? "Requesting…" : "Request booking"}
				</button>

				<div className={t.typography.faint}>
					{isStudent ? (
						<>
							Status will start as <span className="font-semibold">requested</span>.
						</>
					) : (
						<>
							Signed in as: <span className="font-semibold">{me?.email ?? "unknown"}</span>
						</>
					)}
				</div>
			</div>
		</div>
	);
}

function EmptyState({ icon, title, body }) {
	return (
		<div className={t.components.card.muted}>
			<div className="p-4">
				<div className="flex items-center gap-2 text-slate-900 font-semibold">
					<span className="text-slate-400">{icon}</span>
					{title}
				</div>
				<div className={`${t.typography.muted} mt-1`}>{body}</div>
			</div>
		</div>
	);
}

/* ---------------- Utils ---------------- */

function startOfDayUtc(tsS) {
	const d = new Date(tsS * 1000);
	return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000;
}

function buildSlotsFromIntervals(intervals, slotS, opts) {
	const { windowStartS, windowEndS, dayStartHour, dayEndHour } = opts;

	const out = {};
	const norm = (intervals || [])
		.map((it) => ({
			s: Math.max(windowStartS, Number(it.start_ts)),
			e: Math.min(windowEndS, Number(it.end_ts)),
		}))
		.filter((it) => it.e > it.s);

	for (let day = windowStartS; day < windowEndS; day += 86400) {
		const dayStart = day;
		const displayStart = dayStart + dayStartHour * 3600;
		const displayEnd = dayStart + dayEndHour * 3600;

		const slots = [];
		const dayIntervals = norm
			.map(({ s, e }) => ({ s: Math.max(s, displayStart), e: Math.min(e, displayEnd) }))
			.filter((it) => it.e > it.s);

		for (const it of dayIntervals) {
			let cur = alignUp(it.s, slotS);
			while (cur + slotS <= it.e) {
				slots.push({ start_ts: cur, end_ts: cur + slotS });
				cur += slotS;
			}
		}

		if (slots.length) out[dayStart] = slots;
	}

	return out;
}

function alignUp(x, step) {
	const r = x % step;
	return r === 0 ? x : x + (step - r);
}

function overlapsAny(slot, intervals) {
	if (!intervals || intervals.length === 0) return false;
	for (const it of intervals) {
		if (slot.start_ts < it.end_ts && slot.end_ts > it.start_ts) return true;
	}
	return false;
}
