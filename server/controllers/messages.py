"""
messages — engagement-scoped chat (api-contract.md §8).

REST is the only write path (POST inserts + validates once); the websocket
route is a pure server->client broadcast of messages created via REST. See
server/realtime/connection_manager.py for the push layer.
"""
from __future__ import annotations

from typing import Optional

from fastapi import (
    APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status,
)

from server.dependencies import get_current_user, get_current_user_ws
from server.models import (
    engagement_model, expert_model, message_model, notification_model, organization_model,
)
from server.models.errors import NotFoundError
from server.realtime.connection_manager import manager
from server.schemas.common import PaginatedResponse
from server.schemas.messages import MessageCreate, MessageResponse, MessagesReadRequest

router = APIRouter(tags=["messages"])


async def _is_participant(user, engagement_row) -> bool:
    """
    Checked directly against the engagement row's own org_id/expert_id -- no
    join through connection_requests needed, since those columns are copied
    onto the engagement at creation time. Non-raising (bool) so the websocket
    route can use it too -- it can't raise an HTTPException mid-handshake and
    expect a clean close.
    """
    if user["role"] == "admin":
        return True
    if user["role"] == "organization":
        org = await organization_model.find_by_user(user["user_id"])
        return org is not None and org["org_profile_id"] == engagement_row["org_id"]
    if user["role"] == "expert":
        expert = await expert_model.find_by_user(user["user_id"])
        return expert is not None and expert["expert_profile_id"] == engagement_row["expert_id"]
    return False


async def _assert_participant_or_admin(current_user, engagement_row) -> None:
    """REST-route wrapper: own private copy of the check, matching this
    codebase's convention (connections.py and organizations.py/experts.py
    each keep their own instead of sharing one)."""
    if await _is_participant(current_user, engagement_row):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"error": {"code": "FORBIDDEN", "message": "Not a participant in this engagement"}},
    )


async def _other_participant_user_id(engagement_row, sender_id: int) -> Optional[int]:
    """Who should be notified about a new message: whichever side the sender
    ISN'T. Returns None if that side's profile can't be resolved (shouldn't
    normally happen once an engagement exists, but don't 500 on it)."""
    org = await organization_model.get(engagement_row["org_id"])
    if org["user_id"] != sender_id:
        return org["user_id"]
    expert = await expert_model.get(engagement_row["expert_id"])
    if expert["user_id"] != sender_id:
        return expert["user_id"]
    return None


@router.get("/engagements/{engagement_id}/messages",
            response_model=PaginatedResponse[MessageResponse])
async def list_messages(
    engagement_id: int,
    unread: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
):
    engagement = await engagement_model.get(engagement_id)
    await _assert_participant_or_admin(current_user, engagement)
    rows, total = await message_model.list_for_engagement(
        engagement_id, unread=unread, page=page, limit=limit
    )
    return {
        "data": rows,
        "pagination": {
            "page": page, "limit": limit, "total_items": total,
            "total_pages": (total + limit - 1) // limit if total else 0,
        },
    }


@router.post("/engagements/{engagement_id}/messages", status_code=201,
             response_model=MessageResponse)
async def send_message(
    engagement_id: int,
    body: MessageCreate,
    current_user=Depends(get_current_user),
):
    engagement = await engagement_model.get(engagement_id)
    await _assert_participant_or_admin(current_user, engagement)

    message = await message_model.create(
        engagement_id, current_user["user_id"], body.message_type,
        content=body.content, document_id=body.document_id,
    )

    other_user_id = await _other_participant_user_id(engagement, current_user["user_id"])
    if other_user_id is not None:
        await notification_model.create(
            other_user_id, "message_received",
            "New message" + (f": {engagement['title']}" if engagement.get("title") else ""),
            body=message["content"],
            related_entity_type="engagement", related_entity_id=engagement_id,
            action_url=f"/engagements/{engagement_id}",
        )

    await manager.broadcast(engagement_id, message)
    return message


@router.post("/engagements/{engagement_id}/messages/read")
async def mark_messages_read(
    engagement_id: int,
    body: MessagesReadRequest,
    current_user=Depends(get_current_user),
):
    engagement = await engagement_model.get(engagement_id)
    await _assert_participant_or_admin(current_user, engagement)
    updated = await message_model.mark_read(
        engagement_id, current_user["user_id"],
        message_ids=body.message_ids, all=body.all,
    )
    await notification_model.mark_read_by_action_url(
        current_user["user_id"], f"/engagements/{engagement_id}"
    )
    return {"updated": updated}


@router.websocket("/engagements/{engagement_id}/ws")
async def engagement_ws(websocket: WebSocket, engagement_id: int, token: str = Query(...)):
    # Accept first, then close with an app code on failure: rejecting BEFORE
    # accept() doesn't reliably surface a readable close code to browser JS,
    # so the client can't branch on *why* the connection failed.
    await websocket.accept()

    user = await get_current_user_ws(token)
    if user is None:
        await websocket.close(code=4001)  # unauthenticated
        return
    try:
        engagement = await engagement_model.get(engagement_id)
    except NotFoundError:
        await websocket.close(code=4004)  # engagement not found
        return
    if not await _is_participant(user, engagement):
        await websocket.close(code=4003)  # not a participant
        return

    await manager.connect(engagement_id, websocket)
    try:
        while True:
            # Client never sends anything meaningful; this just blocks until
            # the socket closes so we can clean up in the finally block.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(engagement_id, websocket)
