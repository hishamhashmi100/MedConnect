"""Pure functions that turn a doctor's weekly availability into bookable slots.

Nothing here touches the database, so the rules are easy to test on their own.
"""

from datetime import datetime, time, timedelta

# Patients can book today and the next 13 days
BOOKING_WINDOW_DAYS = 14
# The search page shows the first open slot within this many days
NEXT_SLOT_DAYS = 7


def to_minutes(t):
    return t.hour * 60 + t.minute


def from_minutes(minutes):
    return time(minutes // 60, minutes % 60)


def add_minutes(start, minutes):
    return from_minutes(to_minutes(start) + minutes)


def day_slots(blocks, slot_minutes):
    """Every slot start time inside the given time blocks, in order."""
    starts = []
    for block in blocks:
        start = to_minutes(block.start_time)
        end = to_minutes(block.end_time)
        # Only whole slots count, so a 9:00 to 10:45 block with 30 minute slots stops at 10:00
        while start + slot_minutes <= end:
            starts.append(from_minutes(start))
            start += slot_minutes
    return sorted(starts)


def is_bookable_date(day, today):
    return today <= day < today + timedelta(days=BOOKING_WINDOW_DAYS)


def open_slots(day, availability, slot_minutes, booked, now):
    """Open slot start times on one day.

    booked is a list of (start_time, end_time) pairs already taken on that day.
    Past days, and slots that have already started today, are never open.
    """
    if day < now.date():
        return []

    blocks = [block for block in availability if block.day_of_week == day.weekday()]
    result = []
    for start in day_slots(blocks, slot_minutes):
        end = add_minutes(start, slot_minutes)
        if day == now.date() and start <= now.time():
            continue
        # Compare as ranges so a booking made before the doctor changed slot length still blocks
        if any(start < booked_end and booked_start < end for booked_start, booked_end in booked):
            continue
        result.append(start)
    return result


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
