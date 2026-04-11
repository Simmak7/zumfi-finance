"""API endpoint for user feedback / issue reporting."""

import asyncio
from fastapi import APIRouter, Depends, File, Form, UploadFile
from core.auth import get_current_user
from features.auth.models import User
from features.feedback.service import send_feedback_email

router = APIRouter(prefix="/feedback", tags=["feedback"])

MAX_ATTACHMENTS = 5
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB per file


@router.post("")
async def submit_feedback(
    subject: str = Form(..., max_length=200),
    page: str = Form(..., max_length=50),
    description: str = Form(..., max_length=5000),
    contact_email: str = Form(default=""),
    attachments: list[UploadFile] = File(default=[]),
    user: User = Depends(get_current_user),
):
    """Submit a feedback / issue report. Sends email in background."""
    file_data: list[tuple[str, bytes]] = []
    for f in attachments[:MAX_ATTACHMENTS]:
        content = await f.read()
        if len(content) <= MAX_FILE_SIZE:
            file_data.append((f.filename or "attachment", content))

    loop = asyncio.get_event_loop()
    loop.run_in_executor(
        None,
        send_feedback_email,
        subject,
        page,
        description,
        contact_email or None,
        user.display_name or user.email,
        file_data or None,
    )

    return {"success": True, "message": "Feedback submitted successfully"}
