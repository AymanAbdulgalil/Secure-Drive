-- =============================================================
-- Tables: users, users_audit, group_members
-- =============================================================
-- CREATE TYPE users_audit_action AS ENUM (
--                         'login_success',
--                         'login_failed',
--                         'logout',
--                         'session_revoked',
--                         'account_created',
--                         'account_deleted',
--                         'account_restored',
--                         'email_verified',
--                         'password_changed',
--                         'password_reset_requested',
--                         'email_changed',
--                         'storage_quota_changed'
--                     );


-- -------------------------------------------------------------
-- Users
-- -------------------------------------------------------------
CREATE TABLE users (
    user_id              UUID PRIMARY KEY,
    email                VARCHAR(255) UNIQUE NOT NULL,
    password_hash        VARCHAR(255) NOT NULL,
    name                 VARCHAR(255) NOT NULL,

    -- Timestamps
    created_at           TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    updated_at           TIMESTAMPTZ DEFAULT NULL,
    last_login           TIMESTAMPTZ DEFAULT NULL,
     
    -- Storage
    storage_used         BIGINT NOT NULL DEFAULT 0,
    storage_quota        BIGINT NOT NULL DEFAULT 10737418240,    -- 10 GiB

    -- Versions
    verification_version INT NOT NULL DEFAULT 0,  -- for email verification tokens
    -- password_version     INT NOT NULL DEFAULT 0,  -- for password reset tokens

    -- State
    verified             BOOLEAN NOT NULL DEFAULT FALSE,
    valid_since          TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),   -- used to invalidate old tokens
    is_active            BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE users
    ADD CONSTRAINT chk_users_email_format
        CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    ADD CONSTRAINT chk_users_storage_used_non_negative
        CHECK (storage_used >= 0),
    ADD CONSTRAINT chk_users_storage_quota_positive
        CHECK (storage_quota > 0),
    ADD CONSTRAINT chk_users_storage_within_quota
        CHECK (storage_used <= storage_quota),
    ADD CONSTRAINT chk_users_name_not_blank
        CHECK (LENGTH(TRIM(name)) > 0);

CREATE INDEX idx_users_created_at  ON users(created_at);
CREATE INDEX idx_users_is_active   ON users(is_active) WHERE is_active = TRUE;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- -------------------------------------------------------------
-- Users Audit
-- -------------------------------------------------------------
-- CREATE TABLE users_audit (
--     audit_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     user_id         UUID NOT NULL,

--     -- Actor
--     actor_id        UUID,
--     actor_type      VARCHAR(10) NOT NULL CHECK (actor_type IN ('user', 'admin', 'system')),

--     -- Event
--     action          users_audit_action NOT NULL,
--     outcome         VARCHAR(10) NOT NULL CHECK (outcome IN ('success', 'denied', 'error')),
--     denial_reason   VARCHAR(100) DEFAULT NULL,

--     -- Delta (never store raw passwords — hashed or masked values only)
--     old_value       JSONB DEFAULT NULL,
--     new_value       JSONB DEFAULT NULL,

--     created_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
-- );

-- ALTER TABLE users_audit
--     ADD CONSTRAINT chk_users_audit_denial_reason
--         CHECK (
--             (outcome = 'success' AND denial_reason IS NULL)
--             OR
--             (outcome != 'success' AND denial_reason IS NOT NULL)
--         ),
--     ADD CONSTRAINT chk_users_audit_actor_consistency
--         CHECK (actor_type != 'system' AND actor_id IS NOT NULL OR actor_type = 'system' AND actor_id IS NULL);

-- CREATE INDEX idx_users_audit_user_id         ON users_audit(user_id);
-- CREATE INDEX idx_users_audit_actor_id        ON users_audit(actor_id) WHERE actor_id IS NOT NULL;
-- CREATE INDEX idx_users_audit_action          ON users_audit(action);
-- CREATE INDEX idx_users_audit_created_at      ON users_audit(created_at DESC);
-- CREATE INDEX idx_users_audit_outcome         ON users_audit(outcome) WHERE outcome != 'success';
-- CREATE INDEX idx_users_audit_user_activity   ON users_audit(user_id, created_at DESC);

-- CREATE TRIGGER trg_users_audit_immutable
--     BEFORE UPDATE OR DELETE ON users_audit
--     FOR EACH ROW EXECUTE FUNCTION fn_audit_immutable();


-- =============================================================
-- Auto-log changes to the `users` table → users_audit
--
-- Covers:
--   INSERT → account_created
--   UPDATE → email_changed | password_changed | storage_quota_changed
--            | account_deleted | account_restored
--   DELETE → account_deleted (hard delete, rare but handled)
--
-- NOTE: login_*, logout, session_*, email_verified, password_reset_*
--       are application-level events and must be logged by the app.
--       These triggers only handle direct table mutations.
-- =============================================================

-- CREATE OR REPLACE FUNCTION fn_users_audit_log()
-- RETURNS TRIGGER AS $$
-- DECLARE
--     v_action        users_audit_action;
--     v_old_value     JSONB := NULL;
--     v_new_value     JSONB := NULL;
-- BEGIN
--     -- -------------------------------------------------------------
--     -- INSERT → account_created
--     -- -------------------------------------------------------------
--     IF TG_OP = 'INSERT' THEN
--         v_action    := 'account_created';
--         v_new_value := jsonb_build_object(
--             'email',         NEW.email,
--             'name',          NEW.name,
--             'storage_quota', NEW.storage_quota,
--             'verified',      NEW.verified,
--             'is_active',     NEW.is_active
--         );

--         INSERT INTO users_audit (
--             user_id, actor_id, actor_type,
--             action, outcome,
--             old_value, new_value
--         ) VALUES (
--             NEW.user_id, NEW.user_id, 'system',
--             v_action, 'success',
--             v_old_value, v_new_value
--         );

--         RETURN NEW;
--     END IF;

--     -- -------------------------------------------------------------
--     -- DELETE → account_deleted (hard delete)
--     -- -------------------------------------------------------------
--     IF TG_OP = 'DELETE' THEN
--         INSERT INTO users_audit (
--             user_id, actor_id, actor_type,
--             action, outcome,
--             old_value, new_value
--         ) VALUES (
--             OLD.user_id, OLD.user_id, 'system',
--             'account_deleted', 'success',
--             jsonb_build_object(
--                 'email',     OLD.email,
--                 'name',      OLD.name,
--                 'is_active', OLD.is_active
--             ),
--             NULL
--         );

--         RETURN OLD;
--     END IF;

--     -- -------------------------------------------------------------
--     -- UPDATE → determine which field(s) changed
--     -- -------------------------------------------------------------

--     -- Soft delete: is_active TRUE → FALSE
--     IF OLD.is_active = TRUE AND NEW.is_active = FALSE THEN
--         INSERT INTO users_audit (
--             user_id, actor_id, actor_type,
--             action, outcome,
--             old_value, new_value
--         ) VALUES (
--             NEW.user_id, NEW.user_id, 'system',
--             'account_deleted', 'success',
--             jsonb_build_object('is_active', OLD.is_active),
--             jsonb_build_object('is_active', NEW.is_active)
--         );
--     END IF;

--     -- Restore: is_active FALSE → TRUE
--     IF OLD.is_active = FALSE AND NEW.is_active = TRUE THEN
--         INSERT INTO users_audit (
--             user_id, actor_id, actor_type,
--             action, outcome,
--             old_value, new_value
--         ) VALUES (
--             NEW.user_id, NEW.user_id, 'system',
--             'account_restored', 'success',
--             jsonb_build_object('is_active', OLD.is_active),
--             jsonb_build_object('is_active', NEW.is_active)
--         );
--     END IF;

--     -- Email changed
--     IF OLD.email <> NEW.email THEN
--         INSERT INTO users_audit (
--             user_id, actor_id, actor_type,
--             action, outcome,
--             old_value, new_value
--         ) VALUES (
--             NEW.user_id, NEW.user_id, 'user',
--             'email_changed', 'success',
--             jsonb_build_object('email', OLD.email),
--             jsonb_build_object('email', NEW.email)
--         );
--     END IF;

--     -- Password changed (hash changed, never store raw)
--     IF OLD.password_hash <> NEW.password_hash THEN
--         INSERT INTO users_audit (
--             user_id, actor_id, actor_type,
--             action, outcome,
--             old_value, new_value
--         ) VALUES (
--             NEW.user_id, NEW.user_id, 'user',
--             'password_changed', 'success',
--             jsonb_build_object('password_hash', '***'),
--             jsonb_build_object('password_hash', '***')
--         );
--     END IF;

--     -- Storage quota changed
--     IF OLD.storage_quota <> NEW.storage_quota THEN
--         INSERT INTO users_audit (
--             user_id, actor_id, actor_type,
--             action, outcome,
--             old_value, new_value
--         ) VALUES (
--             NEW.user_id, NEW.user_id, 'admin',
--             'storage_quota_changed', 'success',
--             jsonb_build_object('storage_quota', OLD.storage_quota),
--             jsonb_build_object('storage_quota', NEW.storage_quota)
--         );
--     END IF;

--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;


-- CREATE TRIGGER trg_users_audit_log
--     AFTER INSERT OR UPDATE OR DELETE ON users
--     FOR EACH ROW EXECUTE FUNCTION fn_users_audit_log();