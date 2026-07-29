"""
Schema migrations — idempotent, safe to run against any existing database.

Run with:  python -m server.db.migrate
Requires:  DATABASE_URL set in the environment (or .env file).

Each migration is a standalone SQL block guarded by IF NOT EXISTS / IF EXISTS
so re-running is always a no-op. Add new migrations at the bottom of the list.
"""

import asyncio
import logging

from server.db.connection_pool import get_pool, close_pool

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
    (
        "004_consolidate_messages_to_threads",
        """
        -- Create a thread for every engagement pair that has messages, merging
        -- with any existing pre-connection thread for the same pair.
        INSERT INTO chat_threads (org_user_id, expert_user_id)
        SELECT DISTINCT op.user_id, ep.user_id
        FROM messages m
        JOIN engagements e ON e.engagement_id = m.engagement_id
        JOIN organization_profiles op ON op.org_profile_id = e.org_id
        JOIN expert_profiles ep ON ep.expert_profile_id = e.expert_id
        WHERE m.engagement_id IS NOT NULL
        ON CONFLICT (org_user_id, expert_user_id) DO NOTHING;

        -- Also ensure a thread exists for every engagement (even without messages).
        INSERT INTO chat_threads (org_user_id, expert_user_id)
        SELECT DISTINCT op.user_id, ep.user_id
        FROM engagements e
        JOIN organization_profiles op ON op.org_profile_id = e.org_id
        JOIN expert_profiles ep ON ep.expert_profile_id = e.expert_id
        ON CONFLICT (org_user_id, expert_user_id) DO NOTHING;

        -- Point existing engagement messages at their thread.
        UPDATE messages m
        SET thread_id = ct.thread_id
        FROM engagements e
        JOIN organization_profiles op ON op.org_profile_id = e.org_id
        JOIN expert_profiles ep ON ep.expert_profile_id = e.expert_id
        JOIN chat_threads ct ON ct.org_user_id = op.user_id AND ct.expert_user_id = ep.user_id
        WHERE m.engagement_id = e.engagement_id AND m.thread_id IS NULL;

        -- Drop engagement_id and enforce thread_id NOT NULL.
        ALTER TABLE messages DROP COLUMN IF EXISTS engagement_id;
        ALTER TABLE messages ALTER COLUMN thread_id SET NOT NULL;
        """,
    ),
]


async def run():
    db = await get_pool()
    for name, sql in MIGRATIONS:
        logger.info("applying migration: %s", name)
        await db.execute(sql)
        logger.info("done: %s", name)


async def main():
    logging.basicConfig(level=logging.INFO)
    try:
        await run()
    finally:
        await close_pool()


if __name__ == "__main__":
    asyncio.run(main())
