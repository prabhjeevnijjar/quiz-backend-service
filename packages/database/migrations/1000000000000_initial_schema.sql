-- Up Migration
-- =====================================================================
-- QUIZ PLATFORM — PostgreSQL Migration
-- Target: 10,000+ concurrent users, horizontal scaling
-- =====================================================================

BEGIN;

-- Enable pgcrypto for UUID generation if not already enabled (native in PG 13+)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ENUMS ────────────────────────────────────────────────────────────

CREATE TYPE admin_role AS ENUM ('super_admin', 'admin');
CREATE TYPE quiz_status AS ENUM ('draft', 'scheduled', 'live', 'completed', 'archived');
CREATE TYPE question_type AS ENUM ('multiple_choice', 'multi_select', 'true_false', 'short_answer');
CREATE TYPE participant_quiz_status AS ENUM ('invited', 'joined', 'completed', 'disqualified');
CREATE TYPE submission_status AS ENUM ('received', 'processing', 'scored', 'failed');
CREATE TYPE actor_type AS ENUM ('admin', 'participant', 'system');


-- ── ADMIN USERS ──────────────────────────────────────────────────────

CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role admin_role NOT NULL DEFAULT 'admin',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_users_email ON admin_users(email);


-- ── QUIZZES ──────────────────────────────────────────────────────────

CREATE TABLE quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    share_token VARCHAR(128) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status quiz_status NOT NULL DEFAULT 'draft',
    settings JSONB NOT NULL DEFAULT '{}',
    question_count INT NOT NULL DEFAULT 0,
    participant_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quizzes_status_start ON quizzes(status, start_time);
CREATE INDEX idx_quizzes_status_end ON quizzes(status, end_time);
CREATE INDEX idx_quizzes_created_by ON quizzes(created_by);
CREATE INDEX idx_quizzes_share_token ON quizzes(share_token);


-- ── QUESTIONS ────────────────────────────────────────────────────────

CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type question_type NOT NULL,
    options JSONB,
    correct_answer JSONB NOT NULL,
    points SMALLINT NOT NULL DEFAULT 1,
    order_index SMALLINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_questions_quiz_order UNIQUE (quiz_id, order_index)
);

CREATE INDEX idx_questions_quiz_id ON questions(quiz_id);


-- ── PARTICIPANTS ─────────────────────────────────────────────────────

CREATE TABLE participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_participants_email ON participants(email);


-- ── OTP VERIFICATIONS ────────────────────────────────────────────────

CREATE TABLE otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    attempts SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_otps_lookup ON otps(email, expires_at);
CREATE INDEX idx_otps_cleanup ON otps(expires_at);


-- ── QUIZ PARTICIPANTS ────────────────────────────────────────────────

CREATE TABLE quiz_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE RESTRICT,
    status participant_quiz_status NOT NULL DEFAULT 'invited',
    invited_at TIMESTAMPTZ,
    invitation_sent_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_quiz_participant UNIQUE (quiz_id, participant_id)
);

CREATE INDEX idx_qp_quiz_id ON quiz_participants(quiz_id);
CREATE INDEX idx_qp_participant_id ON quiz_participants(participant_id);
CREATE INDEX idx_qp_quiz_status ON quiz_participants(quiz_id, status);


-- ── SUBMISSIONS (HASH PARTITIONED) ───────────────────────────────────

-- Note: Postgres requires the partition key to be part of the primary key
CREATE TABLE submissions (
    id UUID DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL,
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE RESTRICT,
    answers JSONB NOT NULL,
    score INT,
    time_taken_ms INT,
    status submission_status NOT NULL DEFAULT 'received',
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    scored_at TIMESTAMPTZ,
    PRIMARY KEY (id, quiz_id),
    CONSTRAINT uq_submission_quiz_participant UNIQUE (quiz_id, participant_id)
) PARTITION BY HASH (quiz_id);

CREATE INDEX idx_submissions_leaderboard ON submissions(quiz_id, score DESC NULLS LAST, time_taken_ms ASC);
CREATE INDEX idx_submissions_recovery ON submissions(quiz_id, status);
CREATE INDEX idx_submissions_participant ON submissions(participant_id);

-- Create 16 Hash Partitions
CREATE TABLE submissions_p00 PARTITION OF submissions FOR VALUES WITH (MODULUS 16, REMAINDER 0);
CREATE TABLE submissions_p01 PARTITION OF submissions FOR VALUES WITH (MODULUS 16, REMAINDER 1);
CREATE TABLE submissions_p02 PARTITION OF submissions FOR VALUES WITH (MODULUS 16, REMAINDER 2);
CREATE TABLE submissions_p03 PARTITION OF submissions FOR VALUES WITH (MODULUS 16, REMAINDER 3);
CREATE TABLE submissions_p04 PARTITION OF submissions FOR VALUES WITH (MODULUS 16, REMAINDER 4);
CREATE TABLE submissions_p05 PARTITION OF submissions FOR VALUES WITH (MODULUS 16, REMAINDER 5);
CREATE TABLE submissions_p06 PARTITION OF submissions FOR VALUES WITH (MODULUS 16, REMAINDER 6);
CREATE TABLE submissions_p07 PARTITION OF submissions FOR VALUES WITH (MODULUS 16, REMAINDER 7);
CREATE TABLE submissions_p08 PARTITION OF submissions FOR VALUES WITH (MODULUS 16, REMAINDER 8);
CREATE TABLE submissions_p09 PARTITION OF submissions FOR VALUES WITH (MODULUS 16, REMAINDER 9);
CREATE TABLE submissions_p10 PARTITION OF submissions FOR VALUES WITH (MODULUS 16, REMAINDER 10);
CREATE TABLE submissions_p11 PARTITION OF submissions FOR VALUES WITH (MODULUS 16, REMAINDER 11);
CREATE TABLE submissions_p12 PARTITION OF submissions FOR VALUES WITH (MODULUS 16, REMAINDER 12);
CREATE TABLE submissions_p13 PARTITION OF submissions FOR VALUES WITH (MODULUS 16, REMAINDER 13);
CREATE TABLE submissions_p14 PARTITION OF submissions FOR VALUES WITH (MODULUS 16, REMAINDER 14);
CREATE TABLE submissions_p15 PARTITION OF submissions FOR VALUES WITH (MODULUS 16, REMAINDER 15);


-- ── OUTBOX EVENTS (RANGE PARTITIONED) ────────────────────────────────

-- Note: Postgres requires the partition key to be part of the primary key
CREATE TABLE outbox_events (
    id BIGSERIAL,
    aggregate_type VARCHAR(100) NOT NULL,
    aggregate_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    published BOOLEAN NOT NULL DEFAULT false,
    retry_count SMALLINT NOT NULL DEFAULT 0,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Partial index for extreme performance on unpublished events
CREATE INDEX idx_outbox_relay_unpublished ON outbox_events(id) WHERE published = false;
CREATE INDEX idx_outbox_aggregate_id ON outbox_events(aggregate_id);
CREATE INDEX idx_outbox_event_type ON outbox_events(event_type);

-- Create initial partition for current month
CREATE TABLE outbox_events_y2026m06 PARTITION OF outbox_events 
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');


-- ── AUDIT LOGS (RANGE PARTITIONED) ───────────────────────────────────

-- Note: Postgres requires the partition key to be part of the primary key
CREATE TABLE audit_logs (
    id BIGSERIAL,
    actor_id UUID NOT NULL,
    actor_type actor_type NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID NOT NULL,
    old_value JSONB,
    new_value JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id, actor_type);

-- Create initial partition for current month
CREATE TABLE audit_logs_y2026m06 PARTITION OF audit_logs 
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');


-- ── FOREIGN KEYS FOR PARTITIONED TABLES ──────────────────────────────
-- Because Postgres 11+ supports foreign keys pointing to partitioned tables,
-- but the referenced table must have a unique constraint on the exact columns
-- we point to. The standard references are handled above for non-partitioned tables.

-- Note: Submissions referencing quizzes: 
-- Postgres requires FK to target the exact PK or UNIQUE constraint. 
-- Since quizzes PK is `id`, we must add the FK as a table constraint:
ALTER TABLE submissions ADD CONSTRAINT fk_submission_quiz 
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE RESTRICT;

COMMIT;