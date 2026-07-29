from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ThreadCreate(BaseModel):
    expert_profile_id: int


class ThreadMessageCreate(BaseModel):
    message_type: str = "text"
    content: Optional[str] = None


class ThreadMessageResponse(BaseModel):
    message_id: int
    thread_id: int
    sender_id: int
    content: Optional[str] = None
    message_type: str
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime


class ThreadResponse(BaseModel):
    thread_id: int
    org_user_id: int
    expert_user_id: int
    created_at: datetime
    org_name: Optional[str] = None
    org_profile_id: Optional[int] = None
    expert_first_name: Optional[str] = None
    expert_last_name: Optional[str] = None
    expert_profile_id: Optional[int] = None
    unread_count: Optional[int] = None
    last_message_preview: Optional[str] = None
    last_message_at: Optional[datetime] = None
