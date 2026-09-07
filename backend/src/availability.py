from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Iterable, List, Tuple, Optional

SECONDS_PER_DAY = 24 * 60 * 60

Interval = Tuple[int, int]  # (start_ts, end_ts) epoch seconds


def clamp_interval(iv: Interval, win: Interval) -> Optional[Interval]:
    s, e = iv
    ws, we = win
    s2 = max(s, ws)
    e2 = min(e, we)
    if e2 <= s2:
        return None
    return (s2, e2)


def merge_intervals(intervals: Iterable[Interval]) -> List[Interval]:
    """Merge overlapping/adjacent intervals. Assumes epoch seconds."""
    xs = sorted(intervals, key=lambda x: x[0])
    out: List[Interval] = []
    for s, e in xs:
        if not out:
            out.append((s, e))
            continue
        ps, pe = out[-1]
        if s <= pe:  # overlap or adjacent (if you want strictly adjacent merged, use s <= pe)
            out[-1] = (ps, max(pe, e))
        else:
            out.append((s, e))
    return out


def subtract_intervals(base: List[Interval], blocks: List[Interval]) -> List[Interval]:
    """
    Subtract 'blocks' from 'base'. Both should be merged and sorted.
    Returns non-overlapping sorted intervals.
    """
    if not base:
        return []
    if not blocks:
        return base

    out: List[Interval] = []
    bi = 0

    for bs, be in base:
        cur = bs

        while bi < len(blocks) and blocks[bi][1] <= bs:
            bi += 1

        j = bi
        while j < len(blocks) and blocks[j][0] < be:
            xs, xe = blocks[j]
            if xe <= cur:
                j += 1
                continue

            if xs > cur:
                out.append((cur, min(xs, be)))

            cur = max(cur, xe)
            if cur >= be:
                break
            j += 1

        if cur < be:
            out.append((cur, be))

    return out


def day_start_utc(ts: int) -> int:
    dt = datetime.fromtimestamp(ts, tz=timezone.utc)
    d0 = dt.replace(hour=0, minute=0, second=0, microsecond=0)
    return int(d0.timestamp())


def weekday_utc(ts: int) -> int:
    # Monday=0 ... Sunday=6 (Python datetime.weekday())
    return datetime.fromtimestamp(ts, tz=timezone.utc).weekday()


def iter_days_utc(window_start: int, window_end: int) -> List[Tuple[int, int, int]]:
    """
    Returns list of (day_start_ts, day_end_ts, weekday) for each UTC day overlapping [window_start, window_end)
    """
    if window_end <= window_start:
        return []

    d0 = day_start_utc(window_start)
    out = []
    cur = d0

    while cur < window_end:
        nxt = cur + SECONDS_PER_DAY
        wd = weekday_utc(cur)
        out.append((cur, nxt, wd))
        cur = nxt

    return out


def working_intervals_for_window(
    window: Interval,
    hours_by_weekday: dict[int, Tuple[int, int]],
) -> List[Interval]:
    """
    Build working intervals (epoch) inside the window from weekly hours.
    hours_by_weekday: { weekday: (start_s, end_s) } where start_s/end_s are seconds since midnight.
    """
    ws, we = window
    out: List[Interval] = []

    for d_start, d_end, wd in iter_days_utc(ws, we):
        if wd not in hours_by_weekday:
            continue
        start_s, end_s = hours_by_weekday[wd]

        # validate-ish (defensive)
        if not (0 <= start_s < SECONDS_PER_DAY and 0 < end_s <= SECONDS_PER_DAY and end_s > start_s):
            continue

        iv = (d_start + start_s, d_start + end_s)
        iv2 = clamp_interval(iv, window)
        if iv2:
            out.append(iv2)

    return out


def chop_into_slots(intervals: List[Interval], slot_s: int) -> List[Interval]:
    """
    Convert free intervals into fixed-length slots.
    Slots start at the interval start; no rounding to half-hours etc (add later if needed).
    """
    if slot_s <= 0:
        return intervals

    out: List[Interval] = []
    for s, e in intervals:
        cur = s
        while cur + slot_s <= e:
            out.append((cur, cur + slot_s))
            cur += slot_s
    return out


def compute_availability(
    *,
    window: Interval,
    hours_by_weekday: dict[int, Tuple[int, int]],
    bookings: List[Interval],
    off_times: List[Interval],
    slot_s: Optional[int] = None,
) -> List[Interval]:
    base = merge_intervals(working_intervals_for_window(window, hours_by_weekday))

    blocks = []
    for iv in bookings:
        iv2 = clamp_interval(iv, window)
        if iv2:
            blocks.append(iv2)
    for iv in off_times:
        iv2 = clamp_interval(iv, window)
        if iv2:
            blocks.append(iv2)

    blocks = merge_intervals(blocks)

    free = subtract_intervals(base, blocks)

    if slot_s is not None:
        return chop_into_slots(free, slot_s)

    return free