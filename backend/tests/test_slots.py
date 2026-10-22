from datetime import date, datetime, time, timedelta
from types import SimpleNamespace

from app.slots import day_slots, is_bookable_date, next_open_slot, open_slots

MONDAY = date(2026, 10, 19)


def block(day, start, end):
    # Stands in for an Availability row; the slot functions only read these three fields
    return SimpleNamespace(
        day_of_week=day, start_time=time.fromisoformat(start), end_time=time.fromisoformat(end)
    )


def times(*values):
    return [time.fromisoformat(value) for value in values]


def test_only_whole_slots_fit_in_a_block():
    assert day_slots([block(0, "09:00", "10:45")], 30) == times("09:00", "09:30", "10:00")


def test_two_blocks_on_one_day_are_merged_in_order():
    blocks = [block(0, "17:00", "18:00"), block(0, "09:00", "10:00")]
    assert day_slots(blocks, 30) == times("09:00", "09:30", "17:00", "17:30")


def test_booked_slots_are_removed():
    availability = [block(0, "09:00", "10:30")]
    booked = [(time(9, 30), time(10, 0))]
    early = datetime(2026, 10, 18, 8, 0)
    assert open_slots(MONDAY, availability, 30, booked, early) == times("09:00", "10:00")


def test_overlapping_booking_with_another_length_still_blocks():
    # A 15 minute booking from before the doctor switched to 30 minute slots
    availability = [block(0, "09:00", "10:00")]
    booked = [(time(9, 15), time(9, 30))]
    early = datetime(2026, 10, 18, 8, 0)
    assert open_slots(MONDAY, availability, 30, booked, early) == times("09:30")


def test_slots_that_have_started_today_are_hidden():
    availability = [block(0, "09:00", "11:00")]
    now = datetime.combine(MONDAY, time(9, 40))
    assert open_slots(MONDAY, availability, 30, [], now) == times("10:00", "10:30")


def test_past_days_and_days_off_have_no_slots():
    availability = [block(0, "09:00", "11:00")]
    now = datetime.combine(MONDAY, time(8, 0))
    assert open_slots(MONDAY - timedelta(days=7), availability, 30, [], now) == []
    assert open_slots(MONDAY + timedelta(days=1), availability, 30, [], now) == []


def test_next_open_slot_skips_to_the_next_working_day():
    availability = [block(2, "09:00", "10:00")]
    now = datetime.combine(MONDAY, time(8, 0))
    assert next_open_slot(availability, 30, {}, now) == datetime(2026, 10, 21, 9, 0)


def test_next_open_slot_skips_a_fully_booked_day():
    availability = [block(0, "09:00", "10:00"), block(1, "09:00", "10:00")]
    now = datetime.combine(MONDAY, time(8, 0))
    booked = {MONDAY: [(time(9, 0), time(9, 30)), (time(9, 30), time(10, 0))]}
    assert next_open_slot(availability, 30, booked, now) == datetime(2026, 10, 20, 9, 0)


def test_no_next_slot_without_availability():
    assert next_open_slot([], 30, {}, datetime.combine(MONDAY, time(8, 0))) is None


def test_booking_window_is_14_days():
    assert is_bookable_date(MONDAY, MONDAY)
    assert is_bookable_date(MONDAY + timedelta(days=13), MONDAY)
    assert not is_bookable_date(MONDAY + timedelta(days=14), MONDAY)
    assert not is_bookable_date(MONDAY - timedelta(days=1), MONDAY)
