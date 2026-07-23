"""
connection_manager — in-memory registry of open engagement chat sockets.

Single-process, no Redis/pub-sub: correct scope for this deployment (one
uvicorn worker, no multi-process fan-out). Each engagement_id maps to the set
of currently-connected websockets for it; broadcast() pushes a JSON payload
to all of them. This is a pure push channel -- REST is the only write path
(see server/controllers/messages.py), so nothing here ever reads from the DB.

Dev note: uvicorn --reload spawns a fresh process on every file change, which
resets this module-level singleton and silently drops all open sockets.
That's expected -- not a bug to chase.
"""
from __future__ import annotations

import logging

from fastapi import WebSocket
from fastapi.encoders import jsonable_encoder

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self._sockets: dict[int, set[WebSocket]] = {}

    async def connect(self, engagement_id: int, websocket: WebSocket) -> None:
        # Caller has already called websocket.accept() -- this just registers it.
        self._sockets.setdefault(engagement_id, set()).add(websocket)

    def disconnect(self, engagement_id: int, websocket: WebSocket) -> None:
        sockets = self._sockets.get(engagement_id)
        if sockets is None:
            return
        sockets.discard(websocket)
        if not sockets:
            del self._sockets[engagement_id]

    async def broadcast(self, engagement_id: int, payload: dict) -> None:
        sockets = self._sockets.get(engagement_id)
        if not sockets:
            return
        # payload comes straight from asyncpg (datetime, etc.) -- encode once
        # up front rather than relying on send_json's raw json.dumps per-socket.
        encoded = jsonable_encoder(payload)
        dead = []
        for ws in sockets:
            try:
                await ws.send_json(encoded)
            except Exception:
                logger.exception("broadcast to engagement %s socket failed", engagement_id)
                dead.append(ws)
        for ws in dead:
            self.disconnect(engagement_id, ws)


manager = ConnectionManager()
