import datetime as dt
from datetime import datetime, time

from sqlalchemy import (
    ARRAY,
    CheckConstraint,
    Float,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.constants import CITY
from app.database import Base

# Every provider profile goes through the same admin review
APPROVAL_CHECK = "approval_status IN ('pending', 'approved', 'rejected')"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(100), nullable=False)
    # patient / doctor / pharmacy / equipment / caretaker / admin. Kept as a plain string
    # (not a DB enum) so a new provider role needs no schema change.
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    is_verified: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.now, nullable=False)

    # One-to-one: only users with the doctor role have a profile
    doctor_profile: Mapped["DoctorProfile | None"] = relationship(
        back_populates="user", foreign_keys="DoctorProfile.user_id"
    )
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
        CheckConstraint(APPROVAL_CHECK, name="doctor_approval_status_values"),
        CheckConstraint("home_visit_fee > 0", name="doctor_home_visit_fee_positive"),
        # A doctor who does home visits always has a fee for them
        CheckConstraint(
            "NOT offers_home_visit OR home_visit_fee IS NOT NULL", name="doctor_home_visit_has_fee"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    specialty: Mapped[str] = mapped_column(String(50), nullable=False)
    pmdc_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    experience_years: Mapped[int] = mapped_column(nullable=False)
    city: Mapped[str] = mapped_column(String(50), default=CITY, nullable=False)
    # Clinic fees live on each clinic; home visits have their own fee (in rupees)
    offers_home_visit: Mapped[bool] = mapped_column(default=False, nullable=False)
    home_visit_fee: Mapped[int | None] = mapped_column(nullable=True)
    slot_minutes: Mapped[int] = mapped_column(default=30, nullable=False)
    approval_status: Mapped[str] = mapped_column(String(10), default="pending", nullable=False)
    rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(default=datetime.now, nullable=False)
    # The admin who approved or rejected the profile, and when. Empty while it is pending.
    reviewed_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(nullable=True)

    # Two foreign keys point at users, so each relationship names the one it uses
    user: Mapped[User] = relationship(back_populates="doctor_profile", foreign_keys=[user_id])
    reviewer: Mapped[User | None] = relationship(foreign_keys=[reviewed_by])
    # One-to-many: a doctor can work at several clinics and hospitals
    clinics: Mapped[list["Clinic"]] = relationship(
        back_populates="doctor", cascade="all, delete-orphan", order_by=lambda: Clinic.id
    )
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


class Clinic(Base):
    """A clinic or hospital where a doctor sees patients, with the fee they charge there."""

    __tablename__ = "clinics"
    __table_args__ = (CheckConstraint("fee > 0", name="clinic_fee_positive"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    doctor_id: Mapped[int] = mapped_column(
        ForeignKey("doctor_profiles.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    area: Mapped[str] = mapped_column(String(100), nullable=False)
    address: Mapped[str] = mapped_column(String(255), nullable=False)
    fee: Mapped[int] = mapped_column(nullable=False)  # in rupees

    doctor: Mapped[DoctorProfile] = relationship(back_populates="clinics")


class Availability(Base):
    __tablename__ = "availability"
    __table_args__ = (
        CheckConstraint("day_of_week BETWEEN 0 AND 6", name="availability_day_range"),
        # An end at or before the start means the block runs overnight into the next day
        CheckConstraint("start_time <> end_time", name="availability_start_not_end"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    doctor_id: Mapped[int] = mapped_column(
        ForeignKey("doctor_profiles.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # Where the doctor is during this block: one of their clinics, or empty for home visits
    clinic_id: Mapped[int | None] = mapped_column(
        ForeignKey("clinics.id", ondelete="CASCADE"), index=True, nullable=True
    )
    day_of_week: Mapped[int] = mapped_column(nullable=False)  # 0 = Monday ... 6 = Sunday
    start_time: Mapped[time] = mapped_column(nullable=False)
    end_time: Mapped[time] = mapped_column(nullable=False)

    doctor: Mapped[DoctorProfile] = relationship(back_populates="availability")
    clinic: Mapped[Clinic | None] = relationship()


class Appointment(Base):
    __tablename__ = "appointments"
    __table_args__ = (
        CheckConstraint(
            "consultation_type IN ('clinic', 'home')", name="appointment_consultation_type_values"
        ),
        CheckConstraint(
            "status IN ('confirmed', 'cancelled', 'completed')", name="appointment_status_values"
        ),
        CheckConstraint(
            "cancelled_by IN ('patient', 'doctor', 'admin')", name="appointment_cancelled_by_values"
        ),
        # A cancelled booking always says who cancelled it, and only cancelled ones do
        CheckConstraint(
            "(status = 'cancelled') = (cancelled_by IS NOT NULL)",
            name="appointment_cancelled_by_set",
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
    # The clinic for a clinic visit. Emptied if the doctor later removes that clinic.
    clinic_id: Mapped[int | None] = mapped_column(
        ForeignKey("clinics.id", ondelete="SET NULL"), index=True, nullable=True
    )
    # The fee when the patient booked, so a later fee change doesn't alter it (rupees)
    fee: Mapped[int] = mapped_column(nullable=False)
    # Plain text street, area and city. Only filled in for home visits.
    home_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    patient_note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(10), default="confirmed", nullable=False)
    # Who cancelled (patient, doctor or admin) and, for a doctor or admin, why
    cancelled_by: Mapped[str | None] = mapped_column(String(10), nullable=True)
    cancel_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.now, nullable=False)

    patient: Mapped[User] = relationship(back_populates="appointments")
    doctor: Mapped[DoctorProfile] = relationship(back_populates="appointments")
    clinic: Mapped[Clinic | None] = relationship()
    # One-to-many: an appointment can have several reminder emails
    reminders: Mapped[list["EmailReminder"]] = relationship(
        back_populates="appointment", cascade="all, delete-orphan"
    )


class EmailReminder(Base):
    __tablename__ = "email_reminders"
    __table_args__ = (
        CheckConstraint(
            "status IN ('scheduled', 'sent', 'failed', 'cancelled')",
            name="email_reminder_status_values",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    appointment_id: Mapped[int] = mapped_column(
        ForeignKey("appointments.id", ondelete="CASCADE"), index=True, nullable=False
    )
    send_at: Mapped[datetime] = mapped_column(nullable=False)
    sent_at: Mapped[datetime | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(String(10), default="scheduled", nullable=False)

    appointment: Mapped[Appointment] = relationship(back_populates="reminders")


class PharmacyProfile(Base):
    __tablename__ = "pharmacy_profiles"
    __table_args__ = (CheckConstraint(APPROVAL_CHECK, name="pharmacy_approval_status_values"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    pharmacy_name: Mapped[str] = mapped_column(String(150), nullable=False)
    # Drug sale licence, checked by the admin
    license_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    city: Mapped[str] = mapped_column(String(50), nullable=False)
    area: Mapped[str] = mapped_column(String(100), nullable=False)
    address: Mapped[str] = mapped_column(String(255), nullable=False)
    approval_status: Mapped[str] = mapped_column(String(10), default="pending", nullable=False)
    rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(default=datetime.now, nullable=False)
    reviewed_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(nullable=True)

    user: Mapped[User] = relationship(foreign_keys=[user_id])
    reviewer: Mapped[User | None] = relationship(foreign_keys=[reviewed_by])
    # One-to-many: a pharmacy sells many medicines
    medicines: Mapped[list["Medicine"]] = relationship(back_populates="pharmacy")


class Medicine(Base):
    __tablename__ = "medicines"
    __table_args__ = (
        CheckConstraint("price > 0", name="medicine_price_positive"),
        CheckConstraint("stock >= 0", name="medicine_stock_not_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    pharmacy_id: Mapped[int] = mapped_column(
        ForeignKey("pharmacy_profiles.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    price: Mapped[int] = mapped_column(nullable=False)  # rupees per unit
    stock: Mapped[int] = mapped_column(nullable=False)
    requires_prescription: Mapped[bool] = mapped_column(nullable=False)
    # Hidden from the catalogue when false
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    pharmacy: Mapped[PharmacyProfile] = relationship(back_populates="medicines")


class CartItem(Base):
    __tablename__ = "cart_items"
    __table_args__ = (
        # One row per medicine in a patient's cart; adding it again raises the quantity
        UniqueConstraint("patient_id", "medicine_id", name="one_cart_row_per_medicine"),
        CheckConstraint("quantity > 0", name="cart_quantity_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    medicine_id: Mapped[int] = mapped_column(
        ForeignKey("medicines.id", ondelete="CASCADE"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(nullable=False)
    added_at: Mapped[datetime] = mapped_column(default=datetime.now, nullable=False)

    patient: Mapped[User] = relationship()
    medicine: Mapped[Medicine] = relationship()


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint("payment_method IN ('cod')", name="order_payment_method_values"),
        CheckConstraint(
            "status IN ('confirmed', 'preparing', 'out_for_delivery', 'delivered')",
            name="order_status_values",
        ),
        CheckConstraint("total = subtotal - discount", name="order_total_matches"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # One order is from one pharmacy
    pharmacy_id: Mapped[int] = mapped_column(
        ForeignKey("pharmacy_profiles.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # Uploaded prescription image, needed when an item requires a prescription
    prescription_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    delivery_street: Mapped[str] = mapped_column(String(255), nullable=False)
    delivery_area: Mapped[str] = mapped_column(String(100), nullable=False)
    delivery_city: Mapped[str] = mapped_column(String(50), nullable=False)
    # Cash on delivery only
    payment_method: Mapped[str] = mapped_column(String(10), default="cod", nullable=False)
    subtotal: Mapped[int] = mapped_column(nullable=False)
    discount: Mapped[int] = mapped_column(default=0, nullable=False)
    total: Mapped[int] = mapped_column(nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="confirmed", nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.now, nullable=False)

    patient: Mapped[User] = relationship()
    pharmacy: Mapped[PharmacyProfile] = relationship()
    # One-to-many: an order has at least one item
    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )


class OrderItem(Base):
    __tablename__ = "order_items"
    __table_args__ = (CheckConstraint("quantity > 0", name="order_item_quantity_positive"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), index=True, nullable=False
    )
    medicine_id: Mapped[int] = mapped_column(ForeignKey("medicines.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(nullable=False)
    # Price when ordered, so a later price change doesn't alter old orders
    unit_price: Mapped[int] = mapped_column(nullable=False)

    order: Mapped[Order] = relationship(back_populates="items")
    medicine: Mapped[Medicine] = relationship()


class EquipmentProviderProfile(Base):
    __tablename__ = "equipment_provider_profiles"
    __table_args__ = (CheckConstraint(APPROVAL_CHECK, name="equipment_approval_status_values"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    business_name: Mapped[str] = mapped_column(String(150), nullable=False)
    city: Mapped[str] = mapped_column(String(50), nullable=False)
    area: Mapped[str] = mapped_column(String(100), nullable=False)
    address: Mapped[str] = mapped_column(String(255), nullable=False)
    approval_status: Mapped[str] = mapped_column(String(10), default="pending", nullable=False)
    rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(default=datetime.now, nullable=False)
    reviewed_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(nullable=True)

    user: Mapped[User] = relationship(foreign_keys=[user_id])
    reviewer: Mapped[User | None] = relationship(foreign_keys=[reviewed_by])
    # One-to-many: a provider lists many items
    items: Mapped[list["EquipmentItem"]] = relationship(back_populates="provider")


class EquipmentItem(Base):
    __tablename__ = "equipment_items"
    __table_args__ = (
        CheckConstraint(
            "category IN ('wheelchair', 'oxygen', 'hospital_bed', 'other')",
            name="equipment_category_values",
        ),
        CheckConstraint("daily_rate > 0", name="equipment_daily_rate_positive"),
        CheckConstraint("deposit >= 0", name="equipment_deposit_not_negative"),
        CheckConstraint("quantity_available >= 0", name="equipment_quantity_not_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    provider_id: Mapped[int] = mapped_column(
        ForeignKey("equipment_provider_profiles.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    daily_rate: Mapped[int] = mapped_column(nullable=False)  # rupees per day
    deposit: Mapped[int] = mapped_column(default=0, nullable=False)  # refundable
    quantity_available: Mapped[int] = mapped_column(nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    provider: Mapped[EquipmentProviderProfile] = relationship(back_populates="items")


class EquipmentRental(Base):
    __tablename__ = "equipment_rentals"
    __table_args__ = (
        CheckConstraint("end_date >= start_date", name="rental_end_after_start"),
        CheckConstraint("payment_method IN ('cod')", name="rental_payment_method_values"),
        CheckConstraint(
            "status IN ('confirmed', 'delivered', 'in_use', 'returned')",
            name="rental_status_values",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    item_id: Mapped[int] = mapped_column(
        ForeignKey("equipment_items.id", ondelete="CASCADE"), index=True, nullable=False
    )
    start_date: Mapped[dt.date] = mapped_column(nullable=False)
    end_date: Mapped[dt.date] = mapped_column(nullable=False)
    delivery_street: Mapped[str] = mapped_column(String(255), nullable=False)
    delivery_area: Mapped[str] = mapped_column(String(100), nullable=False)
    delivery_city: Mapped[str] = mapped_column(String(50), nullable=False)
    total: Mapped[int] = mapped_column(nullable=False)  # daily_rate x days
    payment_method: Mapped[str] = mapped_column(String(10), default="cod", nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="confirmed", nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.now, nullable=False)

    patient: Mapped[User] = relationship()
    item: Mapped[EquipmentItem] = relationship()


class CaretakerProfile(Base):
    __tablename__ = "caretaker_profiles"
    __table_args__ = (
        CheckConstraint(APPROVAL_CHECK, name="caretaker_approval_status_values"),
        CheckConstraint(
            "service_type IN ('nurse', 'attendant', 'elder_care')",
            name="caretaker_service_type_values",
        ),
        CheckConstraint("daily_rate > 0", name="caretaker_daily_rate_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    service_type: Mapped[str] = mapped_column(String(30), nullable=False)
    experience_years: Mapped[int] = mapped_column(nullable=False)
    city: Mapped[str] = mapped_column(String(50), nullable=False)
    area: Mapped[str] = mapped_column(String(100), nullable=False)
    daily_rate: Mapped[int] = mapped_column(nullable=False)  # rupees per day
    approval_status: Mapped[str] = mapped_column(String(10), default="pending", nullable=False)
    rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(default=datetime.now, nullable=False)
    reviewed_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(nullable=True)

    user: Mapped[User] = relationship(foreign_keys=[user_id])
    reviewer: Mapped[User | None] = relationship(foreign_keys=[reviewed_by])
    # One-to-many: a caretaker receives many bookings
    bookings: Mapped[list["CaretakerBooking"]] = relationship(back_populates="caretaker")


class CaretakerBooking(Base):
    __tablename__ = "caretaker_bookings"
    __table_args__ = (
        CheckConstraint("end_date >= start_date", name="caretaker_booking_end_after_start"),
        CheckConstraint(
            "status IN ('confirmed', 'in_progress', 'completed', 'cancelled')",
            name="caretaker_booking_status_values",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    caretaker_id: Mapped[int] = mapped_column(
        ForeignKey("caretaker_profiles.id", ondelete="CASCADE"), index=True, nullable=False
    )
    start_date: Mapped[dt.date] = mapped_column(nullable=False)
    end_date: Mapped[dt.date] = mapped_column(nullable=False)
    # Where the care is given
    street: Mapped[str] = mapped_column(String(255), nullable=False)
    area: Mapped[str] = mapped_column(String(100), nullable=False)
    city: Mapped[str] = mapped_column(String(50), nullable=False)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    total: Mapped[int] = mapped_column(nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="confirmed", nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.now, nullable=False)

    patient: Mapped[User] = relationship()
    caretaker: Mapped[CaretakerProfile] = relationship(back_populates="bookings")


class HealthRecord(Base):
    __tablename__ = "health_records"
    __table_args__ = (
        CheckConstraint(
            "document_type IN ('prescription', 'lab_report', 'scan', 'discharge_summary', 'other')",
            name="health_record_document_type_values",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # Only the owner can see a record
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    document_type: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    file_path: Mapped[str] = mapped_column(String(255), nullable=False)
    # Text read from the file
    ocr_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(default=datetime.now, nullable=False)

    patient: Mapped[User] = relationship()
    # One-to-many: a record is split into chunks for search
    chunks: Mapped[list["RecordChunk"]] = relationship(
        back_populates="record", cascade="all, delete-orphan"
    )


class RecordChunk(Base):
    __tablename__ = "record_chunks"

    id: Mapped[int] = mapped_column(primary_key=True)
    record_id: Mapped[int] = mapped_column(
        ForeignKey("health_records.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # Kept here so a search can be limited to one patient's records
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    chunk_index: Mapped[int] = mapped_column(nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Stored as a plain float array for now; it becomes a pgvector column once the
    # extension is installed and the embedding model (and so its size) is chosen
    embedding: Mapped[list[float]] = mapped_column(ARRAY(Float), nullable=False)

    record: Mapped[HealthRecord] = relationship(back_populates="chunks")
    patient: Mapped[User] = relationship()


class AiChatSession(Base):
    __tablename__ = "ai_chat_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.now, nullable=False)

    patient: Mapped[User] = relationship()
    # One-to-many: a chat has many messages
    messages: Mapped[list["AiChatMessage"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class AiChatMessage(Base):
    __tablename__ = "ai_chat_messages"
    __table_args__ = (
        CheckConstraint("sender IN ('patient', 'assistant')", name="chat_message_sender_values"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("ai_chat_sessions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    sender: Mapped[str] = mapped_column(String(10), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Filled in when the assistant points the patient to a specialty
    suggested_specialty: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.now, nullable=False)

    session: Mapped[AiChatSession] = relationship(back_populates="messages")


class PromoCode(Base):
    __tablename__ = "promo_codes"
    __table_args__ = (
        CheckConstraint("discount_type IN ('percent', 'flat')", name="promo_discount_type_values"),
        CheckConstraint("discount_value > 0", name="promo_discount_value_positive"),
        CheckConstraint("valid_to >= valid_from", name="promo_valid_to_after_from"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    discount_type: Mapped[str] = mapped_column(String(10), nullable=False)
    # Percent or rupees, depending on discount_type
    discount_value: Mapped[int] = mapped_column(nullable=False)
    min_order_amount: Mapped[int] = mapped_column(default=0, nullable=False)
    valid_from: Mapped[dt.date] = mapped_column(nullable=False)
    valid_to: Mapped[dt.date] = mapped_column(nullable=False)
    # Total uses allowed; empty means no limit
    max_uses: Mapped[int | None] = mapped_column(nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    # One-to-many: a code is used on many orders
    redemptions: Mapped[list["PromoRedemption"]] = relationship(back_populates="promo_code")


class PromoRedemption(Base):
    __tablename__ = "promo_redemptions"
    __table_args__ = (
        # A patient can use each code once
        UniqueConstraint("promo_code_id", "patient_id", name="one_redemption_per_patient"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    promo_code_id: Mapped[int] = mapped_column(
        ForeignKey("promo_codes.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # One promo code per order
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    discount_amount: Mapped[int] = mapped_column(nullable=False)  # rupees taken off
    redeemed_at: Mapped[datetime] = mapped_column(default=datetime.now, nullable=False)

    promo_code: Mapped[PromoCode] = relationship(back_populates="redemptions")
    order: Mapped[Order] = relationship()
    patient: Mapped[User] = relationship()
