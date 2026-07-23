"""
notifications — api-contract.md §8. Server-generated only; every endpoint
here is scoped to the caller's own user_id, no client POST.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query

from server.dependencies import get_current_user
from server.models import notification_model
from server.schemas.common import PaginatedResponse
from server.schemas.notifications import NotificationPatch, NotificationResponse

router = APIRouter(tags=["notifications"])


@router.get("/notifications", response_model=PaginatedResponse[NotificationResponse])
async def list_notifications(
    is_read: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
):
    rows, total = await notification_model.list_for_user(
        current_user["user_id"], is_read=is_read, page=page, limit=limit
    )
    return {
        "data": rows,
        "pagination": {
            "page": page, "limit": limit, "total_items": total,
            "total_pages": (total + limit - 1) // limit if total else 0,
        },
    }


@router.get("/notifications/unread-count")
async def unread_count(current_user=Depends(get_current_user)):
    count = await notification_model.count_unread(current_user["user_id"])
    return {"count": count}


@router.patch("/notifications/{notification_id}", response_model=NotificationResponse)
async def update_notification(
    notification_id: int,
    body: NotificationPatch,
    current_user=Depends(get_current_user),
):
    return await notification_model.mark_read(notification_id, current_user["user_id"])


@router.post("/notifications/read-all")
async def read_all(current_user=Depends(get_current_user)):
    updated = await notification_model.mark_all_read(current_user["user_id"])
    return {"updated": updated}
