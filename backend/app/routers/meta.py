from fastapi import APIRouter

from app.constants import CITIES, SLOT_LENGTHS, SPECIALTIES, SYMPTOMS

# Fixed lists the frontend uses for dropdowns
router = APIRouter(prefix="/api/meta", tags=["meta"])


@router.get("/specialties")
def specialties():
    return SPECIALTIES


@router.get("/symptoms")
def symptoms():
    return [{"symptom": symptom, "specialty": specialty} for symptom, specialty in SYMPTOMS.items()]


@router.get("/cities")
def cities():
    return CITIES


@router.get("/slot-lengths")
def slot_lengths():
    return SLOT_LENGTHS
