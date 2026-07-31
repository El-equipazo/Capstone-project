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
        -- Guarded on engagement_id actually existing -- a fresh install seeded
        -- via server/db/seed.py never has it (messages is created thread_id-only
        -- from the start), and without this guard the migration also isn't
        -- safe to re-run against an already-migrated database, since the
        -- second run would find the column already dropped.
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'messages' AND column_name = 'engagement_id'
            ) THEN
                -- Create a thread for every engagement pair that has messages,
                -- merging with any existing pre-connection thread for the pair.
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

                ALTER TABLE messages DROP COLUMN engagement_id;
            END IF;
        END $$;

        -- Safe unconditionally: already true on a fresh seed, or just backfilled above.
        ALTER TABLE messages ALTER COLUMN thread_id SET NOT NULL;
        """,
    ),
    (
        "005_milestone_pending_change",
        """
        ALTER TABLE engagement_milestones
            ADD COLUMN IF NOT EXISTS pending_action TEXT,
            ADD COLUMN IF NOT EXISTS pending_due_date DATE,
            ADD COLUMN IF NOT EXISTS pending_deliverable_description TEXT,
            ADD COLUMN IF NOT EXISTS pending_requested_by_user_id INTEGER REFERENCES users(user_id),
            ADD COLUMN IF NOT EXISTS pending_requested_at TIMESTAMP;

        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'engagement_milestones_pending_action_check'
            ) THEN
                ALTER TABLE engagement_milestones
                    ADD CONSTRAINT engagement_milestones_pending_action_check
                    CHECK (pending_action IN ('change', 'cancel'));
            END IF;
        END $$;
        """,
    ),
    (
        "006_engagements_proposal_expires_at",
        """
        ALTER TABLE engagements
            ADD COLUMN IF NOT EXISTS proposal_expires_at TIMESTAMP;
        """,
    ),
    (
        "007_engagement_notes_table",
        """
        CREATE TABLE IF NOT EXISTS engagement_notes (
            note_id        SERIAL PRIMARY KEY,
            engagement_id  INTEGER NOT NULL REFERENCES engagements(engagement_id) ON DELETE CASCADE,
            expert_user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
            content        TEXT,
            created_at     TIMESTAMP DEFAULT NOW(),
            updated_at     TIMESTAMP DEFAULT NOW(),
            UNIQUE (engagement_id, expert_user_id)
        );
        """,
    ),
    (
        "008_reviews_table",
        """
        CREATE TABLE IF NOT EXISTS reviews (
            review_id              SERIAL PRIMARY KEY,
            engagement_id          INTEGER REFERENCES engagements(engagement_id) ON DELETE CASCADE,
            reviewer_id             INTEGER REFERENCES users(user_id),
            reviewee_id             INTEGER REFERENCES users(user_id),
            reviewer_role           TEXT NOT NULL,
            overall_rating          SMALLINT NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
            review_title            TEXT,
            review_body             TEXT,
            is_public               BOOLEAN DEFAULT true,
            is_flagged              BOOLEAN DEFAULT false,
            flagged_reason          TEXT,
            created_at              TIMESTAMP DEFAULT NOW(),
            UNIQUE (engagement_id, reviewer_role)
        );
        """,
    ),
    (
        "009_organization_avg_rating",
        """
        ALTER TABLE organization_profiles
            ADD COLUMN IF NOT EXISTS avg_rating NUMERIC(3,2);
        """,
    ),
    (
        "010_engagement_terms_pending_change",
        """
        ALTER TABLE engagements
            ADD COLUMN IF NOT EXISTS pending_start_date DATE,
            ADD COLUMN IF NOT EXISTS pending_estimated_end_date DATE,
            ADD COLUMN IF NOT EXISTS pending_agreed_budget NUMERIC(12,2),
            ADD COLUMN IF NOT EXISTS pending_payment_structure TEXT,
            ADD COLUMN IF NOT EXISTS pending_requested_by_user_id INTEGER REFERENCES users(user_id),
            ADD COLUMN IF NOT EXISTS pending_requested_at TIMESTAMP;
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
