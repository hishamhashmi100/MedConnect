import smtplib
from email.message import EmailMessage

from app.config import settings

SUBJECTS = {
    "verify": "Your MedConnect PK verification code",
    "reset": "Your MedConnect PK password reset code",
}


def send_otp_email(to_email, code, purpose):
    # Without SMTP settings we print the code so sign up still works in development
    if not settings.smtp_user:
        print(f"OTP for {to_email} ({purpose}): {code}")
        return

    message = EmailMessage()
    message["Subject"] = SUBJECTS[purpose]
    message["From"] = f"MedConnect PK <{settings.smtp_user}>"
    message["To"] = to_email
    message.set_content(
        f"Your MedConnect PK code is {code}.\n\n"
        "It expires in 10 minutes. If you did not ask for this code, you can ignore this email."
    )

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as server:
        server.starttls()
        server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(message)
