import re

# Imported under another name because some schemas have a field called "date"
from datetime import date as dt_date
from datetime import datetime, time
from typing import Annotated, Literal

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)

from app.constants import SLOT_LENGTHS, SPECIALTIES

# Emails are stored in lowercase so "Ahmed@Gmail.com" and "ahmed@gmail.com" are one account
Email = Annotated[EmailStr, AfterValidator(str.lower)]
OtpCodeStr = Annotated[str, Field(pattern=r"^\d{6}$")]


def check_password(value):
    # Same rule as the sign up form, so a weak password like "12345678" is refused
    if not re.search(r"[A-Za-z]", value) or not re.search(r"\d", value):
        raise ValueError("Password must contain at least one letter and one number")
    return value


# bcrypt only accepts up to 72 bytes
Password = Annotated[str, Field(min_length=8, max_length=72), AfterValidator(check_password)]


def clean_name(value):
    # Names are stored without the "Dr." title; the app adds it when showing a doctor
    value = re.sub(r"^dr\.?\s+", "", value, flags=re.IGNORECASE)
    value = " ".join(value.split())
    if not re.fullmatch(r"[A-Za-z][A-Za-z .'-]*", value):
        raise ValueError("Name can only contain letters, spaces, dots, hyphens and apostrophes")
    if len(value) < 3:
        raise ValueError("Please enter your full name")
    return value


FullName = Annotated[str, Field(max_length=100), AfterValidator(clean_name)]


class VerifyOtpIn(BaseModel):
    email: Email
    code: OtpCodeStr


class ResendOtpIn(BaseModel):
    email: Email
    purpose: Literal["verify", "reset"]


class LoginIn(BaseModel):
    email: Email
    password: Annotated[str, Field(max_length=72)]
    # The tab chosen on the login page: Patient or Provider (doctor)
    role: Literal["patient", "doctor"]


class ForgotPasswordIn(BaseModel):
    email: Email


class ResetPasswordIn(BaseModel):
    email: Email
    code: OtpCodeStr
    new_password: Password


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str
    role: str
    is_verified: bool


class AuthOut(BaseModel):
    token: str
    user: UserOut


class MessageOut(BaseModel):
    message: str


class DoctorProfileIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    specialty: str
    pmdc_number: str
    experience_years: int = Field(ge=0, le=60)

    @field_validator("specialty")
    @classmethod
    def check_specialty(cls, value):
        if value not in SPECIALTIES:
            raise ValueError("Please choose a specialty from the list")
        return value

    @field_validator("pmdc_number")
    @classmethod
    def check_pmdc(cls, value):
        value = value.upper()
        if not re.fullmatch(r"\d{3,7}-[A-Z]", value):
            raise ValueError("PMDC number should look like 12345-P")
        return value


Fee = Annotated[int, Field(ge=100, le=50000)]


class ClinicIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    # Empty for a clinic the doctor is adding now
    id: int | None = None
    name: str = Field(min_length=3, max_length=100)
    area: str = Field(min_length=3, max_length=100)
    address: str = Field(min_length=10, max_length=255)
    fee: Fee


# Everywhere the doctor sees patients. The whole list is sent and saved at once.
class ClinicsIn(BaseModel):
    clinics: list[ClinicIn] = Field(max_length=10)
    offers_home_visit: bool
    home_visit_fee: Fee | None = None

    @model_validator(mode="after")
    def check_places(self):
        if not self.clinics and not self.offers_home_visit:
            raise ValueError("Please add a clinic or turn on home visits")
        if self.offers_home_visit and self.home_visit_fee is None:
            raise ValueError("Please enter your home visit fee")
        if not self.offers_home_visit:
            self.home_visit_fee = None
        return self


# Where an appointment takes place
class ClinicPlaceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    area: str
    address: str


class ClinicOut(ClinicPlaceOut):
    fee: int


# A clinic as patients see it, with the weekdays (0 = Monday) the doctor is there
class ClinicCardOut(ClinicOut):
    days: list[int]


class RegisterIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    full_name: FullName
    email: Email
    password: Password
    # Admin accounts are only created by seed.py, never through sign up
    role: Literal["patient", "doctor"]
    # Doctors send their professional details with the sign up, so the admin can check them
    doctor_profile: DoctorProfileIn | None = None

    @model_validator(mode="after")
    def check_doctor_profile(self):
        if self.role == "doctor" and self.doctor_profile is None:
            raise ValueError("Please fill in your professional details")
        if self.role == "patient":
            self.doctor_profile = None
        return self


class DoctorProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    specialty: str
    pmdc_number: str
    experience_years: int
    city: str
    clinics: list[ClinicOut]
    offers_home_visit: bool
    home_visit_fee: int | None
    slot_minutes: int
    approval_status: str
    rejection_reason: str | None
    submitted_at: datetime


# What patients see about an approved doctor
class DoctorCardOut(BaseModel):
    id: int
    full_name: str
    specialty: str
    pmdc_number: str
    experience_years: int
    city: str
    slot_minutes: int
    next_open_slot: datetime | None
    # Only places with weekly hours are listed, since the others can't be booked
    clinics: list[ClinicCardOut]
    offers_home_visit: bool
    home_visit_fee: int | None
    home_visit_days: list[int]
    # The lowest fee across the places above, for the search card and the fee sort
    fee_from: int


class DaySlotsOut(BaseModel):
    date: dt_date
    slots: list[time]


class BookingIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    doctor_id: int
    date: dt_date
    start_time: time
    consultation_type: Literal["clinic", "home"]
    # Required for a clinic visit
    clinic_id: int | None = None
    home_address: str | None = Field(default=None, max_length=255)
    patient_note: str | None = Field(default=None, max_length=500)


class RescheduleIn(BaseModel):
    date: dt_date
    start_time: time
    # A clinic visit can move to another of the doctor's clinics. Empty keeps the same one.
    clinic_id: int | None = None


class AppointmentDoctorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    specialty: str
    city: str


class AppointmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date: dt_date
    start_time: time
    end_time: time
    consultation_type: str
    # Empty for a home visit, or if the doctor has since removed the clinic
    clinic: ClinicPlaceOut | None
    fee: int
    home_address: str | None
    patient_note: str | None
    status: str
    cancelled_by: str | None
    cancel_reason: str | None
    created_at: datetime
    doctor: AppointmentDoctorOut


class AppointmentPatientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str


# The doctor's view of a booking: who is coming, rather than which doctor
class DoctorAppointmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date: dt_date
    start_time: time
    end_time: time
    consultation_type: str
    # Empty for a home visit, or if the doctor has since removed the clinic
    clinic: ClinicPlaceOut | None
    fee: int
    home_address: str | None
    patient_note: str | None
    status: str
    cancelled_by: str | None
    cancel_reason: str | None
    patient: AppointmentPatientOut


class AppointmentStatusIn(BaseModel):
    # Cancelling has its own endpoint because it needs a reason
    status: Literal["completed"]


class ReasonIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    reason: str = Field(min_length=5, max_length=500)


class AdminDoctorOut(DoctorProfileOut):
    full_name: str
    email: str
    reviewed_by_name: str | None
    reviewed_at: datetime | None
    # Lets the admin see a doctor who can't be booked yet, and warns before a rejection
    has_hours: bool
    upcoming_appointments: int


class AdminStatsOut(BaseModel):
    patients: int
    new_patients_this_month: int
    appointments_this_month: int
    approved_doctors: int
    pending_approvals: int


class AvailabilityBlock(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    day_of_week: int = Field(ge=0, le=6)
    start_time: time
    end_time: time
    # One of the doctor's clinics, or empty for home visits
    clinic_id: int | None = None


# The appointment length is saved with the weekly hours, because the blocks are checked
# against it
class ScheduleIn(BaseModel):
    slot_minutes: int
    blocks: list[AvailabilityBlock]

    @field_validator("slot_minutes")
    @classmethod
    def check_slot_minutes(cls, value):
        if value not in SLOT_LENGTHS:
            raise ValueError("Please choose an appointment length from the list")
        return value


class AvailabilitySaveOut(BaseModel):
    blocks: list[AvailabilityBlock]
    # Upcoming bookings that no longer fall inside the new hours; they stay booked
    # until the doctor keeps or cancels them
    outside_hours: list[DoctorAppointmentOut]
