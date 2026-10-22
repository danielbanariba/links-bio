import sqlmodel
from datetime import date, datetime
from typing import Optional


class EnrollmentRequest(sqlmodel.SQLModel, table=True):
    """A family's request for a school/program spot for one child.

    Written by POST /api/metal-archive/enrollment (links_bio/fastapi_forms.py).
    Draft: the fields will be corrected by the foundation that owns the form.
    Option-like columns (`relationship`, `monthly_income`) store the Spanish
    label the family picked, so the row and the notification email read the
    same way.
    """

    __tablename__ = "enrollment_requests"

    id: Optional[int] = sqlmodel.Field(default=None, primary_key=True)

    # Guardian
    guardian_name: str
    relationship: str
    phone: str
    email: str = sqlmodel.Field(default="")
    community: str
    address: str = sqlmodel.Field(default="")

    # Child
    child_name: str
    birth_date: date
    grade: str
    current_school: str = sqlmodel.Field(default="")

    # Household
    household_size: int
    monthly_income: str
    reason: str

    consent: bool
    created_at: datetime = sqlmodel.Field(default_factory=datetime.now)
