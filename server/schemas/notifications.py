from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class NotificationPatch(BaseModel):
    is_read: bool


class NotificationResponse(BaseModel):
    notification_id: int
    type: str
    title: str
    body: Optional[str] = None
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[int] = None
    action_url: Optional[str] = None
    is_read: bool
    created_at: datetime
