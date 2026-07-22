from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from server.config import settings
from server.db import connection_pool as pool
from server.models.errors import (
    AuthenticationError,
    ConflictError,
    DeactivatedError,
    GoneError,
    NotFoundError,
    TransitionError,
    ValidationError,
)
from server.controllers import auth, connections, engagements, experts, organizations


@asynccontextmanager
async def lifespan(app: FastAPI):
    await pool.get_pool()
    yield
    await pool.close_pool()


app = FastAPI(
    title="QuantumConnect API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Controller HTTPExceptions → contract error envelope (§1.1) ---
# FastAPI serializes HTTPException as {"detail": ...}; our controllers already
# pass detail={"error": {...}}, so unwrap it to keep the envelope top-level.

@app.exception_handler(StarletteHTTPException)
async def _handle_http_exception(request: Request, exc: StarletteHTTPException):
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        content = exc.detail
    else:
        content = {"error": {"code": "ERROR", "message": str(exc.detail)}}
    return JSONResponse(
        status_code=exc.status_code,
        content=content,
        headers=getattr(exc, "headers", None),
    )


# --- Model-layer exceptions → contract error envelope (§1.1) ---

@app.exception_handler(ValidationError)
async def _handle_validation(request: Request, exc: ValidationError):
    details = (
        [{"field": exc.field, "issue": exc.issue or str(exc)}] if exc.field else None
    )
    return JSONResponse(
        status_code=400,
        content={"error": {"code": "VALIDATION_ERROR", "message": str(exc), "details": details}},
    )


@app.exception_handler(ConflictError)
async def _handle_conflict(request: Request, exc: ConflictError):
    return JSONResponse(
        status_code=409,
        content={"error": {"code": "CONFLICT", "message": str(exc)}},
    )


@app.exception_handler(NotFoundError)
async def _handle_not_found(request: Request, exc: NotFoundError):
    return JSONResponse(
        status_code=404,
        content={"error": {"code": "NOT_FOUND", "message": str(exc)}},
    )


@app.exception_handler(TransitionError)
async def _handle_transition(request: Request, exc: TransitionError):
    return JSONResponse(
        status_code=422,
        content={"error": {"code": "INVALID_TRANSITION", "message": str(exc)}},
    )


@app.exception_handler(GoneError)
async def _handle_gone(request: Request, exc: GoneError):
    return JSONResponse(
        status_code=410,
        content={"error": {"code": "GONE", "message": str(exc)}},
    )


@app.exception_handler(AuthenticationError)
async def _handle_authentication(request: Request, exc: AuthenticationError):
    return JSONResponse(
        status_code=401,
        content={"error": {"code": "UNAUTHORIZED", "message": str(exc)}},
    )


@app.exception_handler(DeactivatedError)
async def _handle_deactivated(request: Request, exc: DeactivatedError):
    return JSONResponse(
        status_code=403,
        content={"error": {"code": "FORBIDDEN", "message": str(exc)}},
    )


# --- Routers ---

app.include_router(auth.router, prefix="/api/v1")
app.include_router(experts.router, prefix="/api/v1")
app.include_router(organizations.router, prefix="/api/v1")
app.include_router(connections.router, prefix="/api/v1")
app.include_router(engagements.router, prefix="/api/v1")
