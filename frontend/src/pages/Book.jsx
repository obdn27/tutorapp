import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lightTheme as t } from "../assets/theme";
import {
	getTutors,
	getTutorAvailability,
	canBook,
	createBooking,
} from "../api";
import { Search, User, CalendarDays } from "lucide-react";

// ---- constants
const SLOT_S = 30 * 60; // 30 min
const WINDOW_DAYS = 7; // show a week
const DAY_START_HOUR = 7; // display grid from 07:00
const DAY_END_HOUR = 21; // to 21:00

export default function Book() {
	const [selectedTutor, setSelectedTutor] = useState(null);
	const [query, setQuery] = useState("");
	const [selectedSlot, setSelectedSlot] = useState(null); // { start_ts, end_ts }

	const qc = useQueryClient();

	const tutorsQ = useQuery({
		queryKey: ["tutors"],
		queryFn: getTutors,
	});

	const nowS = Math.floor(Date.now() / 1000);
	const windowStartS = startOfDayUtc(nowS);
	const windowEndS = windowStartS + WINDOW_DAYS * 86400;

	const availabilityQ = useQuery({
		queryKey: [
			"availability",
			selectedTutor?.id,
			windowStartS,
			windowEndS,
			SLOT_S,
		],
		enabled: !!selectedTutor?.id,
		queryFn: () =>
			getTutorAvailability({
				tutorId: selectedTutor.id,
				startTs: windowStartS,
				endTs: windowEndS,
				slotS: SLOT_S,
			}),
	});

	const tutors = tutorsQ.data ?? [];
	const filteredTutors = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return tutors;
		return tutors.filter((tutor) => {
			const name =
				`${tutor.first_name ?? ""} ${tutor.last_name ?? ""}`.toLowerCase();
			const email = (tutor.email ?? "").toLowerCase();
			const subjects = Array.isArray(tutor.subjects)
				? tutor.subjects.join(" ").toLowerCase()
				: "";
			return name.includes(q) || email.includes(q) || subjects.includes(q);
		});
	}, [tutors, query]);

	const slots = useMemo(() => {
		const intervals = availabilityQ.data?.intervals ?? [];
		return buildSlotsFromIntervals(intervals, SLOT_S, {
			windowStartS,
			windowEndS,
			dayStartHour: DAY_START_HOUR,
			dayEndHour: DAY_END_HOUR,
		});
	}, [availabilityQ.data, windowStartS, windowEndS]);

	const submitMut = useMutation({
		mutationFn: async ({ tutor_id, start_ts, end_ts, notes }) => {
			// optional pre-check for nicer UX (server still enforces)
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
		},
	});

	return (
		<div className={`${t.components.container.page}`}>
			<div
				className={`${t.components.container.content} ${t.components.container.section}`}
			>
				<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
					{/* Tutors list */}
					<div className="lg:col-span-4 min-w-0">
						<div className={t.components.card.base}>
							<div className="p-5 sm:p-6 border-b border-slate-100">
								<div className="flex items-center justify-between gap-3">
									<h2 className={t.typography.h3}>Tutors</h2>
									<span
										className={`${t.components.badge.base} ${t.components.badge.brand}`}
									>
										{filteredTutors.length}
									</span>
								</div>

								<div className="mt-4">
									<div className="relative">
										<Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
										<input
											className={`${t.components.input.soft} pl-10`}
											placeholder="Search by name, subject, email…"
											value={query}
											onChange={(e) => setQuery(e.target.value)}
										/>
									</div>
								</div>
							</div>

							<div className="p-3 sm:p-4 flex-1 min-h-0">
								{tutorsQ.isLoading ? (
									<div className={t.typography.muted}>Loading tutors…</div>
								) : tutorsQ.isError ? (
									<div className={`${t.components.alert.base} ${t.components.alert.error}`}>
										Failed to load tutors.
									</div>
								) : (
									<div className="flex flex-col gap-2">
										{filteredTutors.map((tutor) => (
											<TutorRow
												key={tutor.id}
												tutor={tutor}
												selected={selectedTutor?.id === tutor.id}
												onSelect={() => {
													setSelectedTutor(tutor);
													setSelectedSlot(null);
												}}
											/>
										))}
										{filteredTutors.length === 0 ? (
											<div className={t.typography.muted}>No tutors match your search.</div>
										) : null}
									</div>
								)}
							</div>
						</div>
					</div>

					{/* Availability viewer */}
					<div className="lg:col-span-5 min-w-0">
						<div className={t.components.card.base}>
							<div className="p-5 sm:p-6 border-b border-slate-100">
								<div className="flex items-start justify-between gap-3">
									<div>
										<h2 className={t.typography.h3}>Availability</h2>
										<div className={t.typography.muted}>
											{selectedTutor
												? `Pick a slot for ${selectedTutor.first_name} ${selectedTutor.last_name}`
												: "Select a tutor to view available slots."}
										</div>
									</div>

									<div className="flex items-center gap-2">
										<span
											className={`${t.components.badge.base} ${t.components.badge.neutral}`}
										>
											{SLOT_S / 60} min slots
										</span>
									</div>
								</div>
							</div>

							<div className="p-5 sm:p-6">
								{!selectedTutor ? (
									<EmptyState
										icon={<CalendarDays className="w-5 h-5" />}
										title="No tutor selected"
										body="Choose a tutor from the left to see their availability."
									/>
								) : availabilityQ.isLoading ? (
									<div className={t.typography.muted}>
										Loading availability…
									</div>
								) : availabilityQ.isError ? (
									<div
										className={`${t.components.alert.base} ${t.components.alert.error}`}
									>
										Failed to load availability.
									</div>
								) : (
									<AvailabilityGrid
										slotsByDay={slots}
										selectedSlot={selectedSlot}
										onPick={(slot) => setSelectedSlot(slot)}
									/>
								)}
							</div>
						</div>
					</div>

					{/* Booking sidebar */}
					<div className="lg:col-span-3 min-w-0">
						<BookingPanel
							tutor={selectedTutor}
							slot={selectedSlot}
							onClearSlot={() => setSelectedSlot(null)}
							isSubmitting={submitMut.isPending}
							submitError={submitMut.error}
							onSubmit={(notes) => {
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
		</div>
	);
}

/** ---------------- Components ---------------- */

function TutorRow({ tutor, selected, onSelect }) {
	const fullName =
		`${tutor.first_name ?? ""} ${tutor.last_name ?? ""}`.trim() ||
		"Unnamed tutor";
	const subjects = Array.isArray(tutor.subjects) ? tutor.subjects : [];
	const avg =
		tutor.no_ratings && tutor.no_ratings > 0
			? tutor.rating_sum / tutor.no_ratings
			: null;

	const cls = selected ? t.components.nav.linkActive : t.components.nav.link;

	return (
		<button onClick={onSelect} className={`${cls} w-full text-left`}>
			<div className="flex items-start gap-3">
				<div className="mt-0.5">
					<User className="w-4 h-4 text-slate-400" />
				</div>

				<div className="min-w-0 flex-1">
					<div className="font-semibold text-slate-900 truncate">
						{fullName}
					</div>
					<div className={t.typography.faint}>
						£{tutor.hourly_gbp ?? "-"} / hr ·{" "}
						{avg === null ? "—" : avg.toFixed(1)} ({tutor.no_ratings ?? 0})
					</div>

					{subjects.length ? (
						<div className="mt-2 flex flex-wrap gap-2">
							{subjects.slice(0, 3).map((s) => (
								<span
									key={s}
									className={`${t.components.badge.base} ${t.components.badge.neutral}`}
								>
									{s}
								</span>
							))}
							{subjects.length > 3 ? (
								<span
									className={`${t.components.badge.base} ${t.components.badge.neutral}`}
								>
									+{subjects.length - 3}
								</span>
							) : null}
						</div>
					) : null}
				</div>
			</div>
		</button>
	);
}

function EmptyState({ icon, title, body }) {
	return (
		<div className={`${t.components.card.muted}`}>
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

function AvailabilityGrid({ slotsByDay, selectedSlot, onPick }) {
	const days = Object.keys(slotsByDay)
		.map((k) => Number(k))
		.sort((a, b) => a - b);

	if (days.length === 0) {
		return (
			<div className={t.typography.muted}>No availability in this window.</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			{days.map((dayStartTs) => {
				const slots = slotsByDay[dayStartTs];
				const d = new Date(dayStartTs * 1000);

				return (
					<div key={dayStartTs} className={`${t.components.card.subtle}`}>
						<div className="p-3 border-b border-slate-100 flex items-center justify-between">
							<div className="font-semibold text-slate-900">
								{d.toLocaleDateString("en-GB", {
									weekday: "long",
									day: "numeric",
									month: "short",
								})}
							</div>
							<div className={t.typography.faint}>{slots.length} slots</div>
						</div>

						<div className="p-3">
							<div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
								{slots.map((slot) => {
									const label = new Date(
										slot.start_ts * 1000,
									).toLocaleTimeString("en-GB", {
										hour: "2-digit",
										minute: "2-digit",
									});

									const isSelected =
										selectedSlot &&
										selectedSlot.start_ts === slot.start_ts &&
										selectedSlot.end_ts === slot.end_ts;

									return (
										<button
											key={slot.start_ts}
											onClick={() => onPick(slot)}
											className={
												isSelected
													? `${t.components.nav.linkActive} justify-center`
													: `${t.components.nav.link} justify-center`
											}
										>
											{label}
										</button>
									);
								})}
							</div>
						</div>
					</div>
				);
			})}
		</div>
	);
}

function BookingPanel({
	tutor,
	slot,
	onClearSlot,
	onSubmit,
	isSubmitting,
	submitError,
}) {
	const [notes, setNotes] = useState("");

	const canSubmit = Boolean(tutor && slot && !isSubmitting);

	const slotText = useMemo(() => {
		if (!slot) return null;
		const s = new Date(slot.start_ts * 1000);
		const e = new Date(slot.end_ts * 1000);
		return `${s.toLocaleDateString("en-GB", {
			weekday: "short",
			day: "numeric",
			month: "short",
		})} · ${s.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} – ${e.toLocaleTimeString(
			"en-GB",
			{ hour: "2-digit", minute: "2-digit" },
		)}`;
	}, [slot]);

	const errorMsg = submitError
		? String(submitError.code || submitError.message || submitError)
		: null;

	return (
		<div className={t.components.card.base}>
			<div className="p-5 sm:p-6 border-b border-slate-100">
				<h2 className={t.typography.h3}>Request booking</h2>
				<div className={t.typography.muted}>
					{tutor
						? "Pick an available slot then send the request."
						: "Select a tutor first."}
				</div>
			</div>

			<div className="p-5 sm:p-6 flex flex-col gap-4">
				<div className={t.components.card.muted}>
					<div className="p-4">
						<div className="font-semibold text-slate-900">
							{tutor
								? `${tutor.first_name} ${tutor.last_name}`
								: "No tutor selected"}
						</div>
						<div className={t.typography.muted}>
							{slotText ? slotText : "No time selected"}
						</div>

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

				<div>
					<label className={t.components.input.label}>Notes (optional)</label>
					<textarea
						rows={5}
						className={t.components.input.soft}
						placeholder="Anything the tutor should know…"
						value={notes}
						onChange={(e) => setNotes(e.target.value)}
					/>
					<div className={t.components.input.helper}>
						Keep it short. You can add more later.
					</div>
				</div>

				{errorMsg ? (
					<div
						className={`${t.components.alert.base} ${t.components.alert.error}`}
					>
						{errorMsg}
					</div>
				) : null}

				<button
					disabled={!canSubmit}
					onClick={() => onSubmit(notes)}
					className={`${t.components.button.base} ${t.components.button.primary} w-full`}
				>
					{isSubmitting ? "Requesting…" : "Request booking"}
				</button>

				<div className={t.typography.faint}>
					Status will start as <span className="font-semibold">requested</span>.
				</div>
			</div>
		</div>
	);
}

/** ---------------- Utils ---------------- */

// return day start in UTC seconds
function startOfDayUtc(tsS) {
	const d = new Date(tsS * 1000);
	return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000;
}

function buildSlotsFromIntervals(intervals, slotS, opts) {
	const { windowStartS, windowEndS, dayStartHour, dayEndHour } = opts;

	// map dayStart -> array of slots
	const out = {};

	// clamp + normalize
	const norm = (intervals || [])
		.map((it) => ({
			s: Math.max(windowStartS, Number(it.start_ts)),
			e: Math.min(windowEndS, Number(it.end_ts)),
		}))
		.filter((it) => it.e > it.s);

	for (let day = windowStartS; day < windowEndS; day += 86400) {
		const dayStart = day;
		const dayEnd = day + 86400;

		const displayStart = dayStart + dayStartHour * 3600;
		const displayEnd = dayStart + dayEndHour * 3600;

		const slots = [];

		// get intervals intersecting this day display window
		const dayIntervals = norm
			.map(({ s, e }) => ({
				s: Math.max(s, displayStart),
				e: Math.min(e, displayEnd),
			}))
			.filter((it) => it.e > it.s);

		for (const it of dayIntervals) {
			// align to slot boundary
			let cur = alignUp(it.s, slotS);
			const end = it.e;

			while (cur + slotS <= end) {
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
