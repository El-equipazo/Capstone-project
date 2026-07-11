"""
QuantumConnect — Database Pool
================================
Shared asyncpg connection pool for the QuantumConnect platform.

This is the Python/asyncpg equivalent of a Node.js `pool.js` module:
instead of opening a fresh connection every time (asyncpg.connect), the app
creates one pool at startup and reuses pooled connections across requests.

Usage:
    from pool import query, fetchrow, fetch, fetchval, transaction, close_pool

    rows = await fetch("SELECT * FROM experts WHERE sector = $1", "financial")
    one  = await fetchrow("SELECT * FROM users WHERE user_id = $1", 42)
    n    = await fetchval("SELECT COUNT(*) FROM users")
    await query("UPDATE users SET is_active = false WHERE user_id = $1", 42)

    # Multi-statement atomic work (also the right place for DEFERRED
    # constraint triggers like match_scoring_factors' weight-sum check):
    async with transaction() as conn:
        await conn.execute("INSERT INTO match_scoring_factors ...")
        await conn.execute("INSERT INTO match_scoring_factors ...")
        # deferred trigger fires here, at COMMIT

    # On shutdown (e.g. FastAPI lifespan / atexit):
    await close_pool()

Set DATABASE_URL to your Postgres connection string before running.
Example:   postgresql://postgres:password@localhost/quantumconnect
"""

import os
from contextlib import asynccontextmanager

import asyncpg

# -- CONFIG --------------------------------------------------------------------
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://localhost/quantumconnect",
)

# Pool sizing -- tune to your deployment. min stays warm; max caps concurrency.
POOL_MIN_SIZE = int(os.environ.get("DB_POOL_MIN_SIZE", "2"))
POOL_MAX_SIZE = int(os.environ.get("DB_POOL_MAX_SIZE", "10"))

# Module-level singleton. Lazily created on first use.
_pool: asyncpg.Pool | None = None


# -- POOL LIFECYCLE ------------------------------------------------------------
async def get_pool() -> asyncpg.Pool:
    """
    Return the shared pool, creating it on first call.

    Python equivalent of `const pool = new Pool(...)` in pool.js, except
    creation is async so it's done lazily behind this accessor.
    """
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=DATABASE_URL,
            min_size=POOL_MIN_SIZE,
            max_size=POOL_MAX_SIZE,
            command_timeout=60,
        )
    return _pool


async def close_pool() -> None:
    """
    Gracefully close the pool and all its connections.

    Equivalent to `pool.end()` in Node.js. Safe to call multiple times.
    Call this on application shutdown so no connections are left dangling.
    """
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


# -- QUERY HELPERS -------------------------------------------------------------
# These acquire a connection from the pool, run the statement, and release it
# automatically -- you never manage connections by hand in normal app code.

async def query(sql: str, *args) -> str:
    """
    Execute a statement that returns no rows (INSERT/UPDATE/DELETE/DDL).
    Returns asyncpg's status string, e.g. 'INSERT 0 1'.
    Equivalent to `pool.query(...)` when you don't need the rows back.
    """
    pool = await get_pool()
    return await pool.execute(sql, *args)


async def fetch(sql: str, *args) -> list[asyncpg.Record]:
    """
    Run a query and return all rows as a list of Records.
    Equivalent to `const { rows } = await pool.query(...)` -> rows.
    """
    pool = await get_pool()
    return await pool.fetch(sql, *args)


async def fetchrow(sql: str, *args) -> asyncpg.Record | None:
    """
    Run a query and return the first row (or None).
    Equivalent to `rows[0]` in Node.js pg.
    """
    pool = await get_pool()
    return await pool.fetchrow(sql, *args)


async def fetchval(sql: str, *args, column: int = 0):
    """
    Run a query and return a single scalar value from the first row.
    Handy for COUNT(*), EXISTS, RETURNING a single id, etc.
    """
    pool = await get_pool()
    return await pool.fetchval(sql, *args, column=column)


# -- TRANSACTIONS --------------------------------------------------------------
@asynccontextmanager
async def transaction():
    """
    Acquire a pooled connection and open a transaction around it.

        async with transaction() as conn:
            await conn.execute(...)
            await conn.execute(...)

    Everything inside commits together, or rolls back together on error.
    This is also the correct scope for DEFERRABLE INITIALLY DEFERRED
    constraint triggers (e.g. the match_scoring_factors weight-sum check),
    which are validated at COMMIT rather than per-statement.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            yield conn