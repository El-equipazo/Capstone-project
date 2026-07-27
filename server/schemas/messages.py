from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class MessageCreate(BaseModel):
    message_type: str = "text"        # 'text' | 'file' -- validated against CLIENT_MESSAGE_TYPE
    content: Optional[str] = None
    document_id: Optional[int] = None


class MessagesReadRequest(BaseModel):
    message_ids: Optional[List[int]] = None
    all: bool = False


class MessageResponse(BaseModel):
    message_id: int
    engagement_id: int
    sender_id: int
    content: Optional[str] = None
    message_type: str
    document_id: Optional[int] = None
    document_name: Optional[str] = None
    document_type: Optional[str] = None
    file_size_bytes: Optional[int] = None
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime
