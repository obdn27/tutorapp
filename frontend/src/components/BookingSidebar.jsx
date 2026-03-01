import React, { useMemo, useState } from "react";
import { lightTheme as t } from "../assets/theme"
import { CalendarDays, Clock, NotebookPen, User, PoundSterling, X } from "lucide-react";

export function BookingSidebar({ selectedTutor, onClearTutor, onSubmit, isSubmitting }) {
	const [date, setDate] = useState('')
	const [startTime, setStartTime] = useState('')
	const [endTime, setEndTime] = useState('')
	const [notes, setNotes] = useState('')

	const canSubmit = useMemo(() => {
		if (!selectedTutor) return false
		if (!date || !startTime || !endTime) return false
		return endTime > startTime
	}, [selectedTutor, date, startTime, endTime])

	const handleSubmit = async (e) => {
		e.preventDefault()
		if (!canSubmit) return

		const startTs = new Date(`${date}T${startTime}`).getTime()
		const endTs = new Date(`${date}T${endTime}`).getTime()

		await onSubmit?.({
			tutor_id: selectedTutor.id,
			start_ts: startTs,
			end_ts: endTs,
			notes,
		})

		setNotes('')
		setStartTime('')
	}

	return (
		<aside className="w-full h-screen lg:w-[360px] bg-white border-l border-slate-200 flex flex-col">
			{/* Header */}
			<div className="px-6 py-6 border-b border-slate-100">
				<div className="text-slate-900 font-bold text-lg">Make a booking</div>
				<div className="text-slate-500 text-sm mt-1">
					{selectedTutor ? "Fill in the details below." : "Pick a tutor from the list."}
				</div>
			</div>

			{/* Content */}
			<div className="px-6 py-6 flex-1 overflow-y-auto">
				{!selectedTutor ? (
					<div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
						<div className="flex items-center gap-2 text-slate-700 font-semibold">
							<User className="w-4 h-4 text-slate-400" />
							Pick a tutor to book a session with
						</div>
						<div className="mt-2 text-sm text-slate-500">
							Select a tutor from the grid and their details will show here.
						</div>
					</div>
				) : (
					<>
						{/* Tutor summary */}
						<div className="rounded-2xl border border-slate-200 bg-white p-4">
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0">
									<div className="text-sm font-bold text-slate-900 truncate">
										{(selectedTutor.first_name || "") + " " + (selectedTutor.last_name || "")}
									</div>
									<div className="mt-1 text-sm text-slate-600 truncate">
										{selectedTutor.email}
									</div>
								</div>

								<div className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
									<PoundSterling className="w-4 h-4 text-slate-400" />
									{selectedTutor.hourly_gbp ?? "-"} / hr
								</div>
							</div>

							{Array.isArray(selectedTutor.subjects) && selectedTutor.subjects.length > 0 && (
								<div className="mt-3 flex flex-wrap gap-2">
									{selectedTutor.subjects.slice(0, 6).map((s) => (
										<span
											key={s}
											className={`${t.components.badge} bg-slate-100 text-slate-700`}
										>
											{s}
										</span>
									))}
									{selectedTutor.subjects.length > 6 && (
										<span className={`${t.components.badge} bg-slate-100 text-slate-700`}>
											+{selectedTutor.subjects.length - 6}
										</span>
									)}
								</div>
							)}

							<button
								type="button"
								onClick={onClearTutor}
								className={`${t.components.button.ghostBase} ${t.components.button.ghostHover} mt-3 w-full justify-start`}
							>
								<X className="w-4 h-4" />
								Clear selected tutor
							</button>
						</div>

						{/* Form */}
						<form onSubmit={handleSubmit} className="mt-6 space-y-4">
							<Field label="Date" icon={<CalendarDays className="w-4 h-4 text-slate-400" />}>
								<input
									type="date"
									className={t.components.input.base}
									value={date}
									onChange={(e) => setDate(e.target.value)}
								/>
							</Field>

							<div className="grid grid-cols-2 gap-3">
								<Field label="Start" icon={<Clock className="w-4 h-4 text-slate-400" />}>
									<input
										type="time"
										className={t.components.input.base}
										value={startTime}
										onChange={(e) => setStartTime(e.target.value)}
									/>
								</Field>

								<Field label="End" icon={<Clock className="w-4 h-4 text-slate-400" />}>
									<input
										type="time"
										className={t.components.input.base}
										value={endTime}
										onChange={(e) => setEndTime(e.target.value)}
									/>
								</Field>
							</div>

							<Field label="Notes (optional)" icon={<NotebookPen className="w-4 h-4 text-slate-400" />}>
								<textarea
									rows={5}
									className={t.components.input.base}
									placeholder="Anything the tutor should know…"
									value={notes}
									onChange={(e) => setNotes(e.target.value)}
								/>
							</Field>

							{!canSubmit && (
								<div className="text-sm text-slate-500">
									Fill the date, start time, and end time (end must be after start).
								</div>
							)}

							<button
								type="submit"
								disabled={!canSubmit || isSubmitting}
								className={`${t.components.button.primary} w-full`}
							>
								{isSubmitting ? "Booking…" : "Request booking"}
							</button>

							<div className="text-xs text-slate-400">
								Booking will be created with status{" "}
								<span className="font-semibold">requested</span>.
							</div>
						</form>
					</>
				)}
			</div>
		</aside>
	);
}

function Field({ label, icon, children }) {
	return (
		<div>
			<label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 mb-2">
				{icon}
				{label}
			</label>
			{children}
		</div>
	);
}