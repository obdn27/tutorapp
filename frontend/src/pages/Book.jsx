import { dataClient, endpoints } from "../api"
import { useAuth } from "../Auth"
import { lightTheme as t } from "../assets/theme"
import { useEffect, useState } from "react"
import {
    Mail,
    PoundSterling,
    BookOpen,
    User,
    Star,
    Hash,
} from "lucide-react";
import { BookingSidebar } from "../components/BookingSidebar";

export default function Book() {
    const [tutors, setTutors] = useState([])
    const [currentTutor, setCurrentTutor] = useState(null)

    async function updateTutors() {
        const res = await dataClient.get(endpoints.tutors, {})
        setTutors(res.data)
    }

    useEffect(() => {
        updateTutors()
    }, [accessToken])

    return (
        <div className="flex flex-row">
                <div className="h-screen w-full overflow-y-auto p-4">
                    <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {tutors.map(tutor => (
                            <TutorCard key={tutor.id} tutor={tutor} onClick={() => setCurrentTutor(tutor)} />
                        ))}
                    </ul>
                </div>
            <aside className="w-96 border-l border-slate-200 bg-white h-full flex flex-col">
                <BookingSidebar selectedTutor={currentTutor} onClearTutor={() => { setCurrentTutor(null) }} onSubmit={makeBooking} />
            </aside>
        </div>
    )
}

function TutorCard({ tutor, onClick }) {

    const fullName = `${tutor.first_name ?? ""} ${tutor.last_name ?? ""}`.trim();
    const avgRating =
        tutor.no_ratings && tutor.no_ratings > 0
            ? tutor.rating_sum / tutor.no_ratings
            : null;

    const cardClass = onClick ? t.components.card.interactive : t.components.card.base;

    return (
        <button
            type="button"
            onClick={onClick}
            className={`${cardClass} text-left w-full`}
        >
            <div className="p-4 space-y-3">
                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-400" />
                            <h3 className={`${t.typography.heading} text-base truncate`}>
                                {fullName || "Unnamed tutor"}
                            </h3>
                        </div>

                        <div className="mt-2 flex items-center gap-3 text-sm text-slate-600">
                            <span className="inline-flex items-center gap-1.5 min-w-0">
                                <Mail className="w-4 h-4 text-slate-400" />
                                <span className="truncate">{tutor.email || "No email"}</span>
                            </span>
                        </div>
                    </div>

                    {/* Rating */}
                    <div className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50">
                        <Star className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-bold text-slate-800">
                            {avgRating === null ? "—" : avgRating.toFixed(1)}
                        </span>
                        <span className="text-xs text-slate-500">
                            ({tutor.no_ratings ?? 0})
                        </span>
                    </div>
                </div>

                {/* Price + subjects */}
                <div className="flex items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                        <PoundSterling className="w-4 h-4 text-slate-400" />
                        {tutor.hourly_gbp ?? "-"} / hr
                    </div>

                    <div className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                        <BookOpen className="w-4 h-4 text-slate-400" />
                        {Array.isArray(tutor.subjects) ? tutor.subjects.length : 0} subjects
                    </div>
                </div>

                {/* Bio (short) */}
                <p className={`${t.typography.body} text-sm line-clamp-2`}>
                    {tutor.bio || "No bio provided."}
                </p>

                {/* Subject chips (limit shown) */}
                {Array.isArray(tutor.subjects) && tutor.subjects.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {tutor.subjects.slice(0, 5).map((s) => (
                            <span
                                key={s}
                                className={`${t.components.badge} bg-slate-100 text-slate-700`}
                            >
                                {s}
                            </span>
                        ))}
                        {tutor.subjects.length > 5 && (
                            <span className={`${t.components.badge} bg-slate-100 text-slate-700`}>
                                +{tutor.subjects.length - 5}
                            </span>
                        )}
                    </div>
                ) : (
                    <div className="text-sm text-slate-500">No subjects listed.</div>
                )}
            </div>
        </button>
    );
}

function InfoPill({ icon, text }) {
    return (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 bg-white text-slate-600 text-sm">
            <span className="text-slate-400">{icon}</span>
            <span className="truncate max-w-[18rem]">{text}</span>
        </div>
    );
}