"""Pure functions that turn a doctor's weekly availability into bookable slots.

Nothing here touches the database, so the rules are easy to test on their own.

A block whose end time is at or before its start time runs overnight: Monday 21:00 to
07:00 means Monday 21:00 until midnight, then Tuesday 00:00 to 07:00. Times are worked
out in minutes from midnight, where midnight at the end of a day is 1440.
"""

from datetime import datetime, time, timedelta

# Patients can book today and the next 13 days
BOOKING_WINDOW_DAYS = 14
# The search page shows the first open slot within this many days
NEXT_SLOT_DAYS = 7
MINUTES_IN_DAY = 24 * 60


def to_minutes(t):
    return t.hour * 60 + t.minute


def end_minutes(t):
    # An appointment never runs past midnight, so an end time of 00:00 means the end of the day
    return to_minutes(t) or MINUTES_IN_DAY


def from_minutes(minutes):
    # Midnight at the end of a day is stored as 00:00
    minutes %= MINUTES_IN_DAY
    return time(minutes // 60, minutes % 60)


def add_minutes(start, minutes):
    return from_minutes(to_minutes(start) + minutes)


def block_length(block):
    """Minutes in a block, counting an overnight block across midnight."""
    return (to_minutes(block.end_time) - to_minutes(block.start_time)) % MINUTES_IN_DAY


def segments_on(availability, weekday):
    """The doctor's hours on one weekday as sorted (start, end) minute pairs.

    An overnight block gives two parts: the evening on its own day and the early hours on
    the next day.
    """
    parts = []
    for block in availability:
        start = to_minutes(block.start_time)
        end = to_minutes(block.end_time)
        overnight = end <= start
        if block.day_of_week == weekday:
            parts.append((start, MINUTES_IN_DAY if overnight else end))
        # A block that ends exactly at midnight has nothing on the next day
        if overnight and end > 0 and (block.day_of_week + 1) % 7 == weekday:
            parts.append((0, end))
    return sorted(parts)


def day_slots(availability, weekday, slot_minutes):
    """Every slot start time on one weekday, in order."""
    starts = []
    for start, end in segments_on(availability, weekday):
        # Only whole slots count, so a 9:00 to 10:45 block with 30 minute slots stops at 10:00
        while start + slot_minutes <= end:
            starts.append(from_minutes(start))
            start += slot_minutes
    return sorted(starts)


def blocks_at(availability, clinic_id):
    """The weekly blocks at one place: a clinic id, or None for home visits."""
    return [block for block in availability if block.clinic_id == clinic_id]


def place_days(availability, clinic_id):
    """Weekdays (0 = Monday) the doctor works at one place, including the morning after an
    overnight block."""
    blocks = blocks_at(availability, clinic_id)
    return [weekday for weekday in range(7) if segments_on(blocks, weekday)]


def is_bookable_date(day, today):
    return today <= day < today + timedelta(days=BOOKING_WINDOW_DAYS)


def open_slots(day, availability, slot_minutes, booked, now):
    """Open slot start times on one day.

    booked is a list of (start_time, end_time) pairs already taken on that day.
    Past days, and slots that have already started today, are never open.
    """
    if day < now.date():
        return []

    taken = [(to_minutes(start), end_minutes(end)) for start, end in booked]
    result = []
    for start in day_slots(availability, day.weekday(), slot_minutes):
        if day == now.date() and start <= now.time():
            continue
        # Compare as ranges so a booking made before the doctor changed slot length still blocks
        begin = to_minutes(start)
        finish = begin + slot_minutes
        if any(begin < taken_end and taken_start < finish for taken_start, taken_end in taken):
            continue
        result.append(start)
    return result


def fits_in_hours(day, start, end, availability):
    """True when the time from start to end lies inside the doctor's hours on that day."""
    begin = to_minutes(start)
    finish = end_minutes(end)
    return any(
        part_start <= begin and finish <= part_end
        for part_start, part_end in segments_on(availability, day.weekday())
    )


def next_open_slot(availability, slot_minutes, booked_by_day, now):
    """First open slot in the next NEXT_SLOT_DAYS days as a datetime, or None.

    booked_by_day maps a date to the list of (start_time, end_time) pairs taken that day.
    """
    for offset in range(NEXT_SLOT_DAYS):
        day = now.date() + timedelta(days=offset)
        slots = open_slots(day, availability, slot_minutes, booked_by_day.get(day, []), now)
        if slots:
            return datetime.combine(day, slots[0])
    return None
