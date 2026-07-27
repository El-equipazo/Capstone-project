"""
Schema migrations — idempotent, safe to run against any existing database.

Run with:  python -m server.db.migrate
Requires:  DATABASE_URL set in the environment (or .env file).

Each migration is a standalone SQL block guarded by IF NOT EXISTS / IF EXISTS
so re-running is always a no-op. Add new migrations at the bottom of the list.
"""

import asyncio
import logging

from server.db.connection_pool import pool, close_pool

logger = logging.getLogger(__name__)

MIGRATIONS: list[tuple[str, str]] = [
    # (name, sql)
    (
        "001_connection_requests_ai_columns",
        """
        ALTER TABLE connection_requests
            ADD COLUMN IF NOT EXISTS ai_fit_score INTEGER,
            ADD COLUMN IF NOT EXISTS ai_reasoning TEXT;
        """,
    ),
]


async def run():
    for name, sql in MIGRATIONS:
        logger.info("applying migration: %s", name)
        await pool.execute(sql)
        logger.info("done: %s", name)


async def main():
    logging.basicConfig(level=logging.INFO)
    try:
        await run()
    finally:
        await close_pool()


if __name__ == "__main__":
    asyncio.run(main())
