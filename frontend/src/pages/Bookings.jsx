// src/pages/Bookings.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lightTheme as t } from "../assets/theme";
import { useAuth } from "../Auth";

import {
  getBookings,
  patchBookingStatus,
  rescheduleBooking,
  leaveReview,
  getBookingMessages,
  sendBookingMessage,
} from "../api";

import { MessageSquare, Star, Check, Ban } from "lucide-react";

/* ============================================================================
   Page
============================================================================ */

export default function Bookings() {
  const { me } = useAuth();
  const qc = useQueryClient();

  const bookingsQ = useQuery({ queryKey: ["bookings"], queryFn: getBookings });
  const bookings = bookingsQ.data ?? [];
  const board = useMemo(() => splitBoard4(bookings), [bookings]);

  // Selected booking for messages panel
  const [activeBooking, setActiveBooking] = useState(null);

  // Inline action panel at bottom of a column
  const [panel, setPanel] = useState(null);
  // panel: { type: 'reschedule' | 'rate', booking }
  const closePanel = () => setPanel(null);

  /* ===========================
     Mutations
  =========================== */

  const patchMut = useMutation({
    mutationFn: ({ booking_id, status }) => patchBookingStatus({ booking_id, status }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["bookings"] });
      closePanel();
    },
  });

  const reschedMut = useMutation({
    mutationFn: ({ booking_id, start_ts, end_ts }) =>
      rescheduleBooking({ booking_id, start_ts, end_ts }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["bookings"] });
      closePanel();
    },
  });

  const rateMut = useMutation({
    mutationFn: ({ booking_id, rating, comment }) =>
      leaveReview({ booking_id, rating, comment: comment ?? "" }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["bookings"] });
      closePanel();
    },
  });

  const busyAny = patchMut.isPending || reschedMut.isPending || rateMut.isPending;

  return (
    <div className={`${t.components.container.page} h-full w-full`}>
      <div className="w-full px-4 sm:px-6 lg:px-10 py-6 sm:py-8 h-full">
        <div className="w-full min-h-0 h-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 h-full">
            {/* ===========================
               Board
            =========================== */}
            <div className="lg:col-span-8 min-h-0">
              <div className={`${t.components.card.base} p-5 sm:p-6 flex flex-col min-h-0 h-full`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className={t.typography.h3}>Bookings</h2>
                    <div className={t.typography.muted}>
                      Click a booking to open messages. Use the buttons on the card to act.
                    </div>
                  </div>
                  <span className={`${t.components.badge.base} ${t.components.badge.neutral}`}>
                    {(bookingsQ.data ?? []).length} total
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 min-h-0 flex-1">
                  <BoardColumn
                    title="Requested"
                    hint="Waiting on tutor"
                    q={bookingsQ}
                    footer={
                      panel?.booking && panel.type === "reschedule" && panel.booking.status === "requested" ? (
                        <RescheduleInline
                          booking={panel.booking}
                          onClose={closePanel}
                          onSubmit={({ start_ts, end_ts }) =>
                            reschedMut.mutate({
                              booking_id: panel.booking.id,
                              start_ts,
                              end_ts,
                            })
                          }
                          isSubmitting={reschedMut.isPending}
                          error={reschedMut.isError ? reschedMut.error : null}
                          slotSeconds={me?.slot_s ?? me?.slot_length ?? me?.slot_length_s ?? 1800}
                        />
                      ) : null
                    }
                  >
                    {board.requested.map((b) => (
                      <BookingCard
                        key={b.id}
                        booking={b}
                        selected={activeBooking?.id === b.id}
                        onClick={() => setActiveBooking(b)}
                        meRole={me?.role}
                        busy={busyAny}
                        onAction={(type) => setPanel({ type, booking: b })}
                        onPatchStatus={(status) => patchMut.mutate({ booking_id: b.id, status })}
                      />
                    ))}
                  </BoardColumn>

                  <BoardColumn
                    title="Confirmed"
                    hint="Upcoming sessions"
                    q={bookingsQ}
                    footer={
                      panel?.booking && panel.type === "reschedule" && panel.booking.status === "confirmed" ? (
                        <RescheduleInline
                          booking={panel.booking}
                          onClose={closePanel}
                          onSubmit={({ start_ts, end_ts }) =>
                            reschedMut.mutate({
                              booking_id: panel.booking.id,
                              start_ts,
                              end_ts,
                            })
                          }
                          isSubmitting={reschedMut.isPending}
                          error={reschedMut.isError ? reschedMut.error : null}
                          slotSeconds={me?.slot_s ?? me?.slot_length ?? me?.slot_length_s ?? 1800}
                        />
                      ) : null
                    }
                  >
                    {board.confirmed.map((b) => (
                      <BookingCard
                        key={b.id}
                        booking={b}
                        selected={activeBooking?.id === b.id}
                        onClick={() => setActiveBooking(b)}
                        meRole={me?.role}
                        busy={busyAny}
                        onAction={(type) => setPanel({ type, booking: b })}
                        onPatchStatus={(status) => patchMut.mutate({ booking_id: b.id, status })}
                      />
                    ))}
                  </BoardColumn>

                  <BoardColumn title="Rejected / Canceled" hint="Closed requests" q={bookingsQ}>
                    {board.rejectedCanceled.map((b) => (
                      <BookingCard
                        key={b.id}
                        booking={b}
                        selected={activeBooking?.id === b.id}
                        onClick={() => setActiveBooking(b)}
                        meRole={me?.role}
                        busy={busyAny}
                        onAction={(type) => setPanel({ type, booking: b })}
                        onPatchStatus={(status) => patchMut.mutate({ booking_id: b.id, status })}
                      />
                    ))}
                  </BoardColumn>

                  <BoardColumn
                    title="Completed"
                    hint="Past sessions"
                    q={bookingsQ}
                    footer={
                      panel?.booking && panel.type === "rate" && panel.booking.status === "completed" ? (
                        <RateInline
                          booking={panel.booking}
                          onClose={closePanel}
                          onSubmit={({ rating, comment }) =>
                            rateMut.mutate({ booking_id: panel.booking.id, rating, comment })
                          }
                          isSubmitting={rateMut.isPending}
                          error={rateMut.isError ? rateMut.error : null}
                        />
                      ) : null
                    }
                  >
                    {board.completed.map((b) => (
                      <BookingCard
                        key={b.id}
                        booking={b}
                        selected={activeBooking?.id === b.id}
                        onClick={() => setActiveBooking(b)}
                        meRole={me?.role}
                        busy={busyAny}
                        showRatingHint={me?.role === 0}
                        onAction={(type) => setPanel({ type, booking: b })}
                        onPatchStatus={(status) => patchMut.mutate({ booking_id: b.id, status })}
                      />
                    ))}
                  </BoardColumn>
                </div>
              </div>
            </div>

            {/* ===========================
               Messenger
            =========================== */}
            <div className="lg:col-span-4 min-h-0">
              <BookingMessenger booking={activeBooking} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   Board helpers
============================================================================ */

function toEpochSeconds(x) {
  const n = Number(x ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n > 10_000_000_000 ? Math.floor(n / 1000) : n; // ms -> s
}

function splitBoard4(bookings) {
  const nowS = Math.floor(Date.now() / 1000);

  const requested = [];
  const confirmed = [];
  const rejectedCanceled = [];
  const completed = [];

  for (const b of bookings) {
    const endS = toEpochSeconds(b.end_ts);
    const isPast = endS > 0 && endS <= nowS;

    if (b.status === "completed") {
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

function BoardColumn({ title, hint, q, children, footer }) {
  return (
    <div className="min-h-0 flex flex-col">
      <div className={`${t.components.card.subtle} p-4`}>
        <div className={t.typography.heading}>{title}</div>
        <div className={t.typography.muted}>{hint}</div>
      </div>

      <div className="mt-3 min-h-0 flex-1">
        <div className={`${t.components.card.muted} h-full min-h-0 flex flex-col`}>
          <div className="p-3 flex-1 min-h-0 overflow-y-auto">
            {q.isLoading ? (
              <div className={t.typography.muted}>Loading…</div>
            ) : q.isError ? (
              <div className={`${t.components.alert.base} ${t.components.alert.error}`}>
                Failed to load bookings.
              </div>
            ) : (
              <div className="flex flex-col gap-2">{children}</div>
            )}
          </div>

          {footer ? (
            <div className="border-t border-slate-200 p-3">{footer}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   Booking Card (actions live on the card)
============================================================================ */

function BookingCard({
  booking,
  selected,
  onClick,
  showRatingHint,
  meRole,
  onAction,
  onPatchStatus,
  busy,
}) {
  const start = new Date(toEpochSeconds(booking.start_ts) * 1000);
  const end = new Date(toEpochSeconds(booking.end_ts) * 1000);

  const who = booking.tutor_first_name
    ? `${booking.tutor_first_name} ${booking.tutor_last_name}`
    : booking.student_first_name
    ? `${booking.student_first_name} ${booking.student_last_name}`
    : "Unknown";

  const when =
    `${start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · ` +
    `${start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}–` +
    `${end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;

  const showHint = showRatingHint && meRole === 0 && booking.status === "completed";

  // action buttons shown on hover
  const actions = [];
  if (meRole === 0) {
    if (booking.status === "requested" || booking.status === "confirmed") {
      actions.push({
        key: "reschedule",
        label: "Reschedule",
        cls: t.components.button.neutral,
        onClick: () => onAction?.("reschedule"),
      });
      actions.push({
        key: "cancel",
        label: "Cancel",
        cls: t.components.button.dangerSoft,
        onClick: () => onPatchStatus?.("canceled"),
      });
    }
    if (booking.status === "completed") {
      actions.push({
        key: "rate",
        label: "Rate + review",
        cls: t.components.button.neutral,
        onClick: () => onAction?.("rate"),
      });
    }
  }

  if (meRole === 1) {
    if (booking.status === "requested") {
      actions.push({
        key: "confirm",
        label: "Confirm",
        cls: t.components.button.primary,
        onClick: () => onPatchStatus?.("confirmed"),
      });
      actions.push({
        key: "reject",
        label: "Reject",
        cls: t.components.button.dangerSoft,
        onClick: () => onPatchStatus?.("rejected"),
      });
    }
    if (booking.status === "confirmed") {
      actions.push({
        key: "cancel",
        label: "Cancel",
        cls: t.components.button.dangerSoft,
        onClick: () => onPatchStatus?.("canceled"),
      });
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        `${t.components.card.base} p-3 text-left w-full group`,
        selected ? "ring-2 ring-indigo-500/20 border-indigo-200" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-bold truncate">{who}</div>
          <div className={t.typography.muted}>{when}</div>
        </div>
        <span className={`${t.components.badge.base} ${t.components.badge.neutral}`}>{booking.status}</span>
      </div>

      {booking.notes ? (
        <div className={`${t.typography.muted} mt-2 line-clamp-2`}>{booking.notes}</div>
      ) : null}

      {showHint ? (
        <div className={`${t.typography.faint} mt-2 inline-flex items-center gap-2`}>
          <Star className="w-4 h-4 text-slate-300" />
          Rate + review below
        </div>
      ) : null}

      {actions.length ? (
        <div className="mt-3 hidden group-hover:flex items-center gap-2 flex-wrap">
          {actions.map((a) => (
            <button
              key={a.key}
              type="button"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                a.onClick();
              }}
              className={`${t.components.button.base} ${t.components.button.sm} ${a.cls}`}
            >
              {a.key === "confirm" ? <Check className="w-4 h-4" /> : null}
              {a.key === "reject" ? <Ban className="w-4 h-4" /> : null}
              {a.key === "rate" ? <Star className="w-4 h-4" /> : null}
              {a.label}
            </button>
          ))}
        </div>
      ) : null}
    </button>
  );
}

/* ============================================================================
   Inline panels (render at bottom of a column)
============================================================================ */

function RescheduleInline({ booking, onClose, onSubmit, isSubmitting, error, slotSeconds }) {
  // datetime-local wants "YYYY-MM-DDTHH:MM"
  function toLocalInput(tsS) {
    const d = new Date(toEpochSeconds(tsS) * 1000);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours(),
    )}:${pad(d.getMinutes())}`;
  }
  function fromLocalInput(v) {
    const ms = new Date(v).getTime();
    if (!Number.isFinite(ms)) return null;
    return Math.floor(ms / 1000);
  }

  const startS0 = toEpochSeconds(booking.start_ts);
  const [startLocal, setStartLocal] = useState(() => toLocalInput(startS0));

  const slotS = Number(slotSeconds);
  const slotSFinal = Number.isFinite(slotS) && slotS > 0 ? slotS : 1800;

  return (
    <div className={`${t.components.card.subtle} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={t.typography.heading}>Reschedule</div>
          <div className={t.typography.muted}>Pick a new start time for booking #{booking.id}.</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={`${t.components.button.base} ${t.components.button.sm} ${t.components.button.ghost}`}
        >
          Close
        </button>
      </div>

      <div className="mt-3">
        <label className={t.components.input.label}>Start</label>
        <input
          type="datetime-local"
          className={t.components.input.base}
          value={startLocal}
          onChange={(e) => setStartLocal(e.target.value)}
        />
        <div className={t.typography.faint + " mt-2"}>
          Duration: {Math.round(slotSFinal / 60)} min
        </div>
      </div>

      {error ? (
        <div className={`${t.components.alert.base} ${t.components.alert.error} mt-3`}>
          {String(error?.response?.data?.detail ?? error?.message ?? error)}
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className={`${t.components.button.base} ${t.components.button.neutral}`}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={isSubmitting}
          className={`${t.components.button.base} ${t.components.button.primary}`}
          onClick={() => {
            const start_ts = fromLocalInput(startLocal);
            if (!start_ts) return;
            const end_ts = start_ts + slotSFinal;
            onSubmit({ start_ts, end_ts });
          }}
        >
          {isSubmitting ? "Rescheduling…" : "Reschedule"}
        </button>
      </div>
    </div>
  );
}

function RateInline({ booking, onClose, onSubmit, isSubmitting, error }) {
  const [value, setValue] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");

  return (
    <div className={`${t.components.card.subtle} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={t.typography.heading}>Rate session</div>
          <div className={t.typography.muted}>Booking #{booking.id}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={`${t.components.button.base} ${t.components.button.sm} ${t.components.button.ghost}`}
        >
          Close
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            disabled={isSubmitting}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setValue(i)}
            className={`${t.components.button.icon} ${t.components.button.iconMd} disabled:opacity-50`}
            title={`${i} stars`}
          >
            <Star
              className={`w-5 h-5 ${(hover || value) >= i ? "fill-indigo-600 text-indigo-600" : "text-slate-300"}`}
            />
          </button>
        ))}
      </div>

      <div className="mt-3">
        <label className={t.components.input.label}>Review (optional)</label>
        <textarea
          rows={3}
          className={t.components.input.soft}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Write a short review…"
          disabled={isSubmitting}
        />
      </div>

      {error ? (
        <div className={`${t.components.alert.base} ${t.components.alert.error} mt-3`}>
          {String(error?.response?.data?.detail ?? error?.message ?? error)}
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className={`${t.components.button.base} ${t.components.button.neutral}`}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={isSubmitting || value < 1}
          className={`${t.components.button.base} ${t.components.button.primary}`}
          onClick={() => onSubmit({ rating: value, comment: comment.trim() })}
        >
          {isSubmitting ? "Saving…" : "Submit"}
        </button>
      </div>
    </div>
  );
}

/* ============================================================================
   Messenger
============================================================================ */

function fmtMsgTime(tsS) {
  const d = new Date((tsS ?? 0) * 1000);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function dateKey(tsS) {
  const d = new Date((tsS ?? 0) * 1000);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function fmtDay(tsS) {
  const d = new Date((tsS ?? 0) * 1000);
  const day = d.getDate();
  const month = d.toLocaleString("en-GB", { month: "long" });

  const suffix =
    day % 10 === 1 && day % 100 !== 11
      ? "st"
      : day % 10 === 2 && day % 100 !== 12
      ? "nd"
      : day % 10 === 3 && day % 100 !== 13
      ? "rd"
      : "th";

  return `${day}${suffix} ${month}`;
}

function DayDivider({ tsS }) {
  return (
    <div className="my-3 flex items-center gap-3">
      <div className="h-px flex-1 bg-slate-200" />
      <div className="text-xs font-semibold text-slate-500 whitespace-nowrap">{fmtDay(tsS)}</div>
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  );
}

function BookingMessenger({ booking }) {
  const { me } = useAuth();
  const [draft, setDraft] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    setDraft("");
  }, [booking?.id]);

  const msgsQ = useQuery({
    queryKey: ["messages", booking?.id],
    enabled: !!booking?.id,
    queryFn: () => getBookingMessages({ booking_id: booking.id, limit: 120 }),
    refetchInterval: booking?.id ? 2000 : false,
  });

  const msgs = msgsQ.data?.messages ?? [];

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [booking?.id, msgs.length]);

  const sendMut = useMutation({
    mutationFn: ({ booking_id, message }) => sendBookingMessage({ booking_id, message }),
    onSuccess: async () => {
      setDraft("");
      await msgsQ.refetch();
    },
  });

  const title = booking ? `Booking #${booking.id}` : "Messages";
  const disabled = !booking || sendMut.isPending;

  const renderItems = useMemo(() => {
    const out = [];
    let lastDay = null;

    for (const m of msgs) {
      const dk = dateKey(m.created_at);
      if (dk !== lastDay) {
        out.push({ type: "divider", id: `d-${dk}`, ts: m.created_at });
        lastDay = dk;
      }
      out.push({ type: "msg", id: m.id, msg: m });
    }
    return out;
  }, [msgs]);

  return (
    <div className={`${t.components.card.base} p-5 sm:p-6 flex flex-col min-h-0 h-full`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className={t.typography.h3}>{title}</h3>
          <div className={t.typography.muted}>
            {booking ? "Booking message room" : "Select a booking to view messages."}
          </div>
        </div>
        <MessageSquare className="w-5 h-5 text-slate-400" />
      </div>

      <div ref={listRef} className="mt-5 flex-1 min-h-0 overflow-y-auto pr-1">
        {!booking ? (
          <div className={`${t.components.card.muted} p-4`}>
            <div className="font-semibold text-slate-900">No booking selected</div>
            <div className={t.typography.muted}>Click a booking card to open its room.</div>
          </div>
        ) : msgsQ.isLoading ? (
          <div className={t.typography.muted}>Loading messages…</div>
        ) : msgsQ.isError ? (
          <div className={`${t.components.alert.base} ${t.components.alert.error}`}>
            Failed to load messages.
          </div>
        ) : msgs.length === 0 ? (
          <div className={t.typography.muted}>No messages yet.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {renderItems.map((it) => {
              if (it.type === "divider") return <DayDivider key={it.id} tsS={it.ts} />;

              const m = it.msg;
              const myId = me?.id ?? me?.user_id ?? me?.uid;
              const msgUserId = m.user_id ?? m.author_id ?? m.sender_id ?? m.from_user_id;
              const isMine = myId != null && msgUserId != null && Number(msgUserId) === Number(myId);

              const author =
                m.user_first_name || m.user_last_name
                  ? `${m.user_first_name ?? ""} ${m.user_last_name ?? ""}`.trim()
                  : `User ${m.user_id}`;

              return (
                <div key={m.id} className={`w-full flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={[
                      "max-w-[85%] sm:max-w-[75%] p-3 border rounded-2xl",
                      isMine ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-200",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className={`text-xs font-semibold ${isMine ? "text-indigo-800" : "text-slate-700"} truncate`}>
                        {isMine ? "You" : author}
                      </div>
                      <div className={t.typography.faint}>{fmtMsgTime(m.created_at)}</div>
                    </div>

                    <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{m.message}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <label className={t.components.input.label}>Message</label>
        <textarea
          rows={3}
          className={t.components.input.soft}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={!booking}
          placeholder={booking ? "Type a message…" : "Select a booking first"}
        />

        {sendMut.isError ? (
          <div className={`${t.components.alert.base} ${t.components.alert.error} mt-3`}>Failed to send.</div>
        ) : null}

        <div className="mt-3 flex justify-end">
          <button
            disabled={!booking || !draft.trim() || disabled}
            className={`${t.components.button.base} ${t.components.button.primary}`}
            onClick={() => {
              if (!booking) return;
              sendMut.mutate({ booking_id: booking.id, message: draft.trim() });
            }}
          >
            {sendMut.isPending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}