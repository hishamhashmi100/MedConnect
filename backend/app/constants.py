SPECIALTIES = [
    "General Physician",
    "Cardiologist",
    "Dermatologist",
    "Pediatrician",
    "Gynecologist",
    "Orthopedic Surgeon",
    "ENT Specialist",
    "Neurologist",
    "Psychiatrist",
    "Gastroenterologist",
    "Eye Specialist",
    "Dentist",
]

# Common symptoms and the specialty that usually sees them first
SYMPTOMS = {
    "Fever": "General Physician",
    "Cough and flu": "General Physician",
    "Chest pain": "Cardiologist",
    "High blood pressure": "Cardiologist",
    "Skin rash": "Dermatologist",
    "Acne": "Dermatologist",
    "Child fever or illness": "Pediatrician",
    "Pregnancy care": "Gynecologist",
    "Joint pain": "Orthopedic Surgeon",
    "Back pain": "Orthopedic Surgeon",
    "Ear or throat pain": "ENT Specialist",
    "Headache or migraine": "Neurologist",
    "Anxiety or low mood": "Psychiatrist",
    "Stomach pain": "Gastroenterologist",
    "Blurred vision": "Eye Specialist",
    "Toothache": "Dentist",
}

# Karachi is the pilot city, so it comes first and is the default
CITIES = ["Karachi", "Lahore"]

# Index matches availability.day_of_week (0 = Monday)
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

SLOT_LENGTHS = [15, 20, 30, 45, 60]

# Used by seed.py and the "Explore the patient demo" link
DEMO_PATIENT_EMAIL = "ahmed.raza@example.com"
