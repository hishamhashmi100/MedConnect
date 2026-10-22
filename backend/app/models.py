import datetime as dt
from datetime import datetime, time

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(100), nullable=False)
    # patient / doctor / admin. Kept as a plain string (not a DB enum) so the
    # FYP-II provider roles (pharmacy, equipment, caretaker) can be added later.
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    is_verified: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.now, nullable=False)

    # One-to-one: only users with the doctor role have a profile
    doctor_profile: Mapped["DoctorProfile | None"] = relationship(back_populates="user")
    # One-to-many: a patient has many appointments
    appointments: Mapped[list["Appointment"]] = relationship(back_populates="patient")


class OtpCode(Base):
    __tablename__ = "otp_codes"
    __table_args__ = (CheckConstraint("purpose IN ('verify', 'reset')", name="otp_purpose_values"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    # Linked by email rather than user id, since the code is about proving the email address
    email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    code: Mapped[str] = mapped_column(String(6), nullable=False)
    purpose: Mapped[str] = mapped_column(String(10), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(nullable=False)
    attempts: Mapped[int] = mapped_column(default=0, nullable=False)
    used: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.now, nullable=False)


class DoctorProfile(Base):
    __tablename__ = "doctor_profiles"
    __table_args__ = (
        CheckConstraint(
            "approval_status IN ('pending', 'approved', 'rejected')",
            name="doctor_approval_status_values",
        ),
        CheckConstraint("fee > 0", name="doctor_fee_positive"),
        CheckConstraint("offers_clinic OR offers_home_visit", name="doctor_offers_a_consultation"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    specialty: Mapped[str] = mapped_column(String(50), nullable=False)
    pmdc_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    experience_years: Mapped[int] = mapped_column(nullable=False)
    city: Mapped[str] = mapped_column(String(50), nullable=False)
    area: Mapped[str] = mapped_column(String(100), nullable=False)
    # Only needed when the doctor offers clinic consultations
    clinic_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    fee: Mapped[int] = mapped_column(nullable=False)  # in rupees
    offers_clinic: Mapped[bool] = mapped_column(nullable=False)
    offers_home_visit: Mapped[bool] = mapped_column(nullable=False)
    slot_minutes: Mapped[int] = mapped_column(default=30, nullable=False)
    approval_status: Mapped[str] = mapped_column(String(10), default="pending", nullable=False)
    rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(default=datetime.now, nullable=False)

    user: Mapped[User] = relationship(back_populates="doctor_profile")
    # One-to-many: a doctor has several weekly time blocks
    availability: Mapped[list["Availability"]] = relationship(
        back_populates="doctor",
        cascade="all, delete-orphan",
        order_by=lambda: (Availability.day_of_week, Availability.start_time),
    )
    # One-to-many: a doctor has many appointments
    appointments: Mapped[list["Appointment"]] = relationship(back_populates="doctor")

    # The name lives on the user row; this lets schemas read it straight from the profile
    @property
    def full_name(self):
        return self.user.full_name


class Availability(Base):
    __tablename__ = "availability"
    __table_args__ = (
        CheckConstraint("day_of_week BETWEEN 0 AND 6", name="availability_day_range"),
        CheckConstraint("start_time < end_time", name="availability_start_before_end"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    doctor_id: Mapped[int] = mapped_column(
        ForeignKey("doctor_profiles.id", ondelete="CASCADE"), index=True, nullable=False
    )
    day_of_week: Mapped[int] = mapped_column(nullable=False)  # 0 = Monday ... 6 = Sunday
    start_time: Mapped[time] = mapped_column(nullable=False)
    end_time: Mapped[time] = mapped_column(nullable=False)

    doctor: Mapped[DoctorProfile] = relationship(back_populates="availability")


class Appointment(Base):
    __tablename__ = "appointments"
    __table_args__ = (
        CheckConstraint(
            "consultation_type IN ('clinic', 'home')", name="appointment_consultation_type_values"
        ),
        CheckConstraint(
            "status IN ('confirmed', 'cancelled', 'completed')", name="appointment_status_values"
        ),
        # The same slot can't be booked twice, but a cancelled booking frees it again
        Index(
            "one_booking_per_slot",
            "doctor_id",
            "date",
            "start_time",
            unique=True,
            postgresql_where=text("status != 'cancelled'"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    doctor_id: Mapped[int] = mapped_column(
        ForeignKey("doctor_profiles.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # Written as dt.date because a column called "date" would hide the date type here
    date: Mapped[dt.date] = mapped_column(nullable=False)
    start_time: Mapped[time] = mapped_column(nullable=False)
    end_time: Mapped[time] = mapped_column(nullable=False)
    consultation_type: Mapped[str] = mapped_column(String(10), nullable=False)
    # Plain text street, area and city. Only filled in for home visits.
    home_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    patient_note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(10), default="confirmed", nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.now, nullable=False)

    patient: Mapped[User] = relationship(back_populates="appointments")
    doctor: Mapped[DoctorProfile] = relationship(back_populates="appointments")
