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
    (
        "002_chat_threads_table",
        """
        CREATE TABLE IF NOT EXISTS chat_threads (
            thread_id      SERIAL PRIMARY KEY,
            org_user_id    INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
            expert_user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
            created_at     TIMESTAMP DEFAULT NOW(),
            UNIQUE (org_user_id, expert_user_id)
        );
        """,
    ),
    (
        "003_messages_thread_id",
        """
        ALTER TABLE messages
            ADD COLUMN IF NOT EXISTS thread_id INTEGER REFERENCES chat_threads(thread_id) ON DELETE CASCADE;
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
