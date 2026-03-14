-- -- =============================================================
-- -- Tables: sharing, shared_files_audit
-- -- =============================================================
-- CREATE TYPE shared_files_audit_action AS ENUM (
--                         'share_created',
--                         'share_revoked',
--                         'share_accessed',
--                         'share_access_denied',
--                         'permission_changed',
--                         'password_added',
--                         'password_removed',
--                         'password_changed',
--                         'password_failed',
--                         'expiry_set',
--                         'expiry_changed',
--                         'expiry_removed',
--                         'share_expired',
--                         'access_limit_set',
--                         'access_limit_changed',
--                         'access_limit_removed',
--                         'access_limit_reached'
--                     );


-- -- ─────────────────────────────────────────────────────────────
-- -- Shared Files
-- -- ─────────────────────────────────────────────────────────────
-- CREATE TABLE sharing (
--     share_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

--     -- The file being shared — enforced FK into files
--     file_id         UUID NOT NULL REFERENCES files(file_id) ON DELETE CASCADE,
--     owner_id        UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

--     -- Sharing model
--     share_type      VARCHAR(20) NOT NULL CHECK (share_type IN ('public_link', 'specific_user')),
--     recipient_id    UUID REFERENCES users(user_id) ON DELETE CASCADE,       -- NULL for public_link
--     public_token    VARCHAR(128) UNIQUE,                                    -- NULL for specific_user; must be cryptographically random (≥ 128 bits)

--     -- Password protection
--     password_hash   VARCHAR(256),
--     password_salt   VARCHAR(64),

--     -- Permissions
--     can_view        BOOLEAN NOT NULL DEFAULT TRUE,
--     can_download    BOOLEAN NOT NULL DEFAULT FALSE,
--     can_edit        BOOLEAN NOT NULL DEFAULT FALSE,
--     can_reshare     BOOLEAN NOT NULL DEFAULT FALSE,

--     -- Expiry
--     expires_at      TIMESTAMPTZ DEFAULT NULL,                               -- NULL = no expiry

--     -- State
--     is_revoked      BOOLEAN NOT NULL DEFAULT FALSE,
--     revoked_at      TIMESTAMPTZ DEFAULT NULL,
--     revoked_by      UUID REFERENCES users(user_id) ON DELETE SET NULL,

--     -- Access limits
--     max_access_count    INT DEFAULT NULL,                                   -- NULL = unlimited
--     access_count        INT NOT NULL DEFAULT 0,

--     -- Metadata
--     created_at          TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
--     updated_at          TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
--     created_by_ip       VARCHAR(45),
--     note                TEXT DEFAULT NULL
-- );

-- ALTER TABLE sharing
--     ADD CONSTRAINT chk_shared_recipient_or_token
--         CHECK (
--             (share_type = 'specific_user' AND recipient_id IS NOT NULL AND public_token IS NULL)
--             OR
--             (share_type = 'public_link'   AND public_token IS NOT NULL AND recipient_id IS NULL)
--         ),
--     ADD CONSTRAINT chk_shared_password_fields
--         CHECK (
--             (password_hash IS NULL AND password_salt IS NULL)
--             OR
--             (password_hash IS NOT NULL AND password_salt IS NOT NULL)
--         ),
--     ADD CONSTRAINT chk_shared_revoked_consistency
--         CHECK (
--             (is_revoked = FALSE AND revoked_at IS NULL AND revoked_by IS NULL)
--             OR
--             (is_revoked = TRUE  AND revoked_at IS NOT NULL)
--         ),
--     ADD CONSTRAINT chk_shared_reshare_requires_view
--         CHECK (can_reshare = FALSE OR can_view = TRUE),
--     ADD CONSTRAINT chk_shared_max_access_count_positive
--         CHECK (max_access_count IS NULL OR max_access_count > 0),
--     ADD CONSTRAINT chk_shared_access_count_non_negative
--         CHECK (access_count >= 0),
--     ADD CONSTRAINT chk_shared_access_count_within_max
--         CHECK (max_access_count IS NULL OR access_count <= max_access_count),
--     ADD CONSTRAINT chk_shared_expires_future_on_create
--         -- Prevents setting an expiry that is already in the past at insert time.
--         -- NOTE: only validated at row creation; update path enforced at app layer.
--         CHECK (expires_at IS NULL OR expires_at > created_at),
--     ADD CONSTRAINT chk_shared_owner_not_recipient
--         CHECK (recipient_id IS NULL OR recipient_id != owner_id);

-- CREATE INDEX idx_sharing_file_id        ON sharing(file_id);
-- CREATE INDEX idx_sharing_owner_id       ON sharing(owner_id);
-- CREATE INDEX idx_sharing_recipient_id   ON sharing(recipient_id)   WHERE recipient_id IS NOT NULL;
-- CREATE INDEX idx_sharing_public_token   ON sharing(public_token)   WHERE public_token IS NOT NULL;
-- CREATE INDEX idx_sharing_expires_at     ON sharing(expires_at)     WHERE expires_at IS NOT NULL;
-- CREATE INDEX idx_sharing_active         ON sharing(file_id, is_revoked) WHERE is_revoked = FALSE;

-- CREATE TRIGGER trg_sharing_updated_at
--     BEFORE UPDATE ON sharing
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- -- ─────────────────────────────────────────────────────────────
-- -- Shared Files Audit
-- -- ─────────────────────────────────────────────────────────────
-- CREATE TABLE shared_files_audit (
--     audit_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

--     -- Subject (denormalized + FK)
--     share_id        UUID NOT NULL,
--     share_id_fk     UUID REFERENCES shared_files(share_id) ON DELETE SET NULL,
--     file_id         UUID NOT NULL,                  -- denormalized; survives share deletion

--     -- Actor
--     actor_id        UUID REFERENCES users(user_id) ON DELETE SET NULL,
--     actor_type      VARCHAR(10) NOT NULL CHECK (actor_type IN ('user', 'admin', 'system')),

--     -- Recipient snapshot
--     recipient_id    UUID REFERENCES users(user_id) ON DELETE SET NULL,
--     share_type_snap VARCHAR(20) NOT NULL
--                         CHECK (share_type_snap IN ('public_link', 'specific_user')),

--     -- Event
--     action          shared_files_audit_action NOT NULL,
--     outcome         VARCHAR(10) NOT NULL CHECK (outcome IN ('success', 'denied', 'error')),
--     denial_reason   VARCHAR(100) DEFAULT NULL,

--     -- Delta
--     old_value       JSONB DEFAULT NULL,
--     new_value       JSONB DEFAULT NULL,

--     created_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
-- );

-- ALTER TABLE shared_files_audit
--     ADD CONSTRAINT chk_shared_audit_denial_reason
--         CHECK (
--             (outcome = 'success' AND denial_reason IS NULL)
--             OR
--             (outcome != 'success' AND denial_reason IS NOT NULL)
--         ),
--     ADD CONSTRAINT chk_shared_audit_actor_consistency
--         CHECK (actor_type != 'user' OR actor_id IS NOT NULL),
--     ADD CONSTRAINT chk_shared_audit_mutation_has_values
--         CHECK (
--             action NOT IN (
--                 'permission_changed', 'password_changed',
--                 'expiry_changed', 'access_limit_changed'
--             )
--             OR (old_value IS NOT NULL AND new_value IS NOT NULL)
--         );

-- CREATE INDEX idx_shared_audit_share_id       ON shared_files_audit(share_id);
-- CREATE INDEX idx_shared_audit_file_id        ON shared_files_audit(file_id);
-- CREATE INDEX idx_shared_audit_actor_id       ON shared_files_audit(actor_id) WHERE actor_id IS NOT NULL;
-- CREATE INDEX idx_shared_audit_recipient_id   ON shared_files_audit(recipient_id) WHERE recipient_id IS NOT NULL;
-- CREATE INDEX idx_shared_audit_action         ON shared_files_audit(action);
-- CREATE INDEX idx_shared_audit_created_at     ON shared_files_audit(created_at DESC);
-- CREATE INDEX idx_shared_audit_outcome        ON shared_files_audit(outcome) WHERE outcome != 'success';
-- CREATE INDEX idx_shared_audit_ip             ON shared_files_audit(ip_address);
-- CREATE INDEX idx_shared_audit_share_activity ON shared_files_audit(share_id, created_at DESC);
-- CREATE INDEX idx_shared_audit_file_activity  ON shared_files_audit(file_id, created_at DESC);
-- CREATE INDEX idx_shared_audit_ip_denied      ON shared_files_audit(ip_address, action, created_at DESC)
--                                             WHERE outcome = 'denied';

-- CREATE TRIGGER trg_shared_files_audit_immutable
--     BEFORE UPDATE OR DELETE ON shared_files_audit
--     FOR EACH ROW EXECUTE FUNCTION fn_audit_immutable();