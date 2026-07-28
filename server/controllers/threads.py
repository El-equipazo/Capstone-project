"""
threads — unified chat for all org/expert conversations.

One thread per org/expert pair, shared across pre-connection inquiry and any
active engagement. All messages live in the messages table keyed on thread_id.

  POST  /threads                          org creates/retrieves thread by expert profile
  GET   /threads                          list threads for current user
  GET   /engagements/{id}/thread          get (or create) the thread for an engagement
  GET   /threads/{id}/messages            paginated message history
  POST  /threads/{id}/messages            send a message
  POST  /threads/{id}/messages/read       mark messages read
  WS    /threads/{id}/ws                  real-time push channel
"""
from __future__ import annotations

from typing import Optional

from fastapi import (
    APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status,
)

from server.dependencies import get_current_user, get_current_user_ws, require_role
from server.models import (
    engagement_model, expert_model, message_model,
    notification_model, organization_model, thread_model,
)
from server.models.errors import NotFoundError
from server.realtime.connection_manager import thread_manager
from server.schemas.common import PaginatedResponse
from server.schemas.messages import MessagesReadRequest
from server.schemas.threads import ThreadCreate, ThreadMessageCreate, ThreadMessageResponse, ThreadResponse

router = APIRouter(tags=["threads"])


def _is_participant(user, thread: dict) -> bool:
    return user["user_id"] in (thread["org_user_id"], thread["expert_user_id"])


async def _assert_participant(user, thread: dict) -> None:
    if _is_participant(user, thread):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"error": {"code": "FORBIDDEN", "message": "Not a participant in this thread"}},
    )


async def _other_user_id(thread: dict, sender_id: int) -> int:
    if thread["org_user_id"] == sender_id:
        return thread["expert_user_id"]
    return thread["org_user_id"]


@router.post("/threads", status_code=201, response_model=ThreadResponse)
async def create_thread(
    body: ThreadCreate,
    current_user=Depends(require_role("organization")),
):
    expert = await expert_model.get(body.expert_profile_id)
    thread = await thread_model.get_or_create(current_user["user_id"], expert["user_id"])
    return thread


@router.get("/threads", response_model=list[ThreadResponse])
async def list_threads(current_user=Depends(get_current_user)):
    return await thread_model.list_for_user(current_user["user_id"])


@router.get("/engagements/{engagement_id}/thread", response_model=ThreadResponse)
async def get_thread_for_engagement(
    engagement_id: int,
    current_user=Depends(get_current_user),
):
    """Return (or create) the shared thread for this engagement's org/expert pair."""
    engagement = await engagement_model.get(engagement_id)

    org = await organization_model.get(engagement["org_id"])
    expert = await expert_model.get(engagement["expert_id"])

    # Verify the caller is a participant before revealing or creating the thread.
    is_org = current_user["role"] == "organization" and org["user_id"] == current_user["user_id"]
    is_expert = current_user["role"] == "expert" and expert["user_id"] == current_user["user_id"]
    if not (is_org or is_expert or current_user["role"] == "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Not a participant in this engagement"}},
        )

    thread = await thread_model.get_or_create(org["user_id"], expert["user_id"])
    return thread


@router.get("/threads/{thread_id}/messages",
            response_model=PaginatedResponse[ThreadMessageResponse])
async def list_thread_messages(
    thread_id: int,
    unread: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
):
    thread = await thread_model.get(thread_id)
    await _assert_participant(current_user, thread)
    rows, total = await message_model.list_for_thread(
        thread_id, unread=unread, page=page, limit=limit
    )
    return {
        "data": rows,
        "pagination": {
            "page": page, "limit": limit, "total_items": total,
            "total_pages": (total + limit - 1) // limit if total else 0,
        },
    }


@router.post("/threads/{thread_id}/messages", status_code=201,
             response_model=ThreadMessageResponse)
async def send_thread_message(
    thread_id: int,
    body: ThreadMessageCreate,
    current_user=Depends(get_current_user),
):
    thread = await thread_model.get(thread_id)
    await _assert_participant(current_user, thread)

    message = await message_model.create(
        thread_id, current_user["user_id"],
        body.message_type, content=body.content,
    )

    other_user_id = await _other_user_id(thread, current_user["user_id"])

    action_url = f"/messages?open_thread={thread_id}"

    await notification_model.create(
        other_user_id, "message_received",
        "New message",
        body=message["content"],
        related_entity_type="thread", related_entity_id=thread_id,
        action_url=action_url,
    )

    await thread_manager.broadcast(thread_id, message)
    return message


@router.post("/threads/{thread_id}/messages/read")
async def mark_thread_messages_read(
    thread_id: int,
    body: MessagesReadRequest,
    current_user=Depends(get_current_user),
):
    thread = await thread_model.get(thread_id)
    await _assert_participant(current_user, thread)
    updated = await message_model.mark_read(
        thread_id, current_user["user_id"],
        message_ids=body.message_ids, all=body.all,
    )
    await notification_model.mark_read_by_action_url(
        current_user["user_id"], f"open_thread={thread_id}"
    )
    return {"updated": updated}


@router.websocket("/threads/{thread_id}/ws")
async def thread_ws(websocket: WebSocket, thread_id: int, token: str = Query(...)):
    await websocket.accept()

    user = await get_current_user_ws(token)
    if user is None:
        await websocket.close(code=4001)
        return
    try:
        thread = await thread_model.get(thread_id)
    except NotFoundError:
        await websocket.close(code=4004)
        return
    if not _is_participant(user, thread):
        await websocket.close(code=4003)
        return

    await thread_manager.connect(thread_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        thread_manager.disconnect(thread_id, websocket)
