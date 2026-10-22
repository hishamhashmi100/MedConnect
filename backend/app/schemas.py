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

from app.constants import CITIES, SLOT_LENGTHS, SPECIALTIES

# Emails are stored in lowercase so "Ahmed@Gmail.com" and "ahmed@gmail.com" are one account
Email = Annotated[EmailStr, AfterValidator(str.lower)]
OtpCodeStr = Annotated[str, Field(pattern=r"^\d{6}$")]
# bcrypt only accepts up to 72 bytes
Password = Annotated[str, Field(min_length=8, max_length=72)]


class RegisterIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    full_name: str = Field(min_length=2, max_length=100)
    email: Email
    password: Password
    # Admin accounts are only created by seed.py, never through sign up
    role: Literal["patient", "doctor"]


class VerifyOtpIn(BaseModel):
    email: Email
    code: OtpCodeStr


class ResendOtpIn(BaseModel):
    email: Email
    purpose: Literal["verify", "reset"]


class LoginIn(BaseModel):
    email: Email
    password: Annotated[str, Field(max_length=72)]


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
    city: str
    area: str = Field(min_length=2, max_length=100)
    clinic_address: str | None = Field(default=None, max_length=255)
    fee: int = Field(gt=0, le=100000)
    offers_clinic: bool
    offers_home_visit: bool
    slot_minutes: int = 30

    @field_validator("specialty")
    @classmethod
    def check_specialty(cls, value):
        if value not in SPECIALTIES:
            raise ValueError("Please choose a specialty from the list")
        return value

    @field_validator("city")
    @classmethod
    def check_city(cls, value):
        if value not in CITIES:
            raise ValueError("Please choose a city from the list")
        return value

    @field_validator("pmdc_number")
    @classmethod
    def check_pmdc(cls, value):
        value = value.upper()
        if not re.fullmatch(r"\d{3,7}-[A-Z]", value):
            raise ValueError("PMDC number should look like 12345-P")
        return value

    @field_validator("slot_minutes")
    @classmethod
    def check_slot_minutes(cls, value):
        if value not in SLOT_LENGTHS:
            raise ValueError("Please choose a slot length from the list")
        return value

    @model_validator(mode="after")
    def check_consultation_types(self):
        if not self.offers_clinic and not self.offers_home_visit:
            raise ValueError("Please choose at least one consultation type")
        if self.offers_clinic and not self.clinic_address:
            raise ValueError("Please enter your clinic address")
        if not self.offers_clinic:
            self.clinic_address = None
        return self


class DoctorProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    specialty: str
    pmdc_number: str
    experience_years: int
    city: str
    area: str
    clinic_address: str | None
    fee: int
    offers_clinic: bool
    offers_home_visit: bool
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
    area: str
    clinic_address: str | None
    fee: int
    offers_clinic: bool
    offers_home_visit: bool
    slot_minutes: int
    next_open_slot: datetime | None
    # Weekdays (0 = Monday) the doctor works, so the booking page can grey out the other days
    available_days: list[int]


class DaySlotsOut(BaseModel):
    date: dt_date
    slots: list[time]


class BookingIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    doctor_id: int
    date: dt_date
    start_time: time
    consultation_type: Literal["clinic", "home"]
    home_address: str | None = Field(default=None, max_length=255)
    patient_note: str | None = Field(default=None, max_length=500)


class RescheduleIn(BaseModel):
    date: dt_date
    start_time: time


class AppointmentDoctorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    specialty: str
    area: str
    city: str
    clinic_address: str | None
    fee: int


class AppointmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date: dt_date
    start_time: time
    end_time: time
    consultation_type: str
    home_address: str | None
    patient_note: str | None
    status: str
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
    home_address: str | None
    patient_note: str | None
    status: str
    patient: AppointmentPatientOut


class AppointmentStatusIn(BaseModel):
    # Doctors can only mark a visit as done; cancelling is the patient's action
    status: Literal["completed"]


class AdminDoctorOut(DoctorProfileOut):
    full_name: str
    email: str


class RejectIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    reason: str = Field(min_length=5, max_length=500)


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
