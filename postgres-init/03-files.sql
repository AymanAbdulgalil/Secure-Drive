-- =============================================================
-- Tables: files, files_audit
-- =============================================================
-- CREATE TYPE files_audit_action AS ENUM (
--                         'file_uploaded',
--                         'file_deleted',
--                         'file_restored',
--                         'file_renamed',
--                         'file_moved',
--                         'mime_type_changed',
--                         'file_overwritten',
--                         'ownership_transferred'
--                     );


-- ─────────────────────────────────────────────────────────────
-- files Metadata  (one row per stored file)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE files (
    file_id         UUID PRIMARY KEY,
    owner_id        UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

    -- Storage location
    bucket          TEXT NOT NULL,
    folder          TEXT NOT NULL DEFAULT '/',

    -- File identity
    original_name   TEXT NOT NULL,
    current_name    TEXT NOT NULL,
    mime_type       VARCHAR(255) NOT NULL,
    size_bytes      BIGINT NOT NULL,
    sha256_hex      CHAR(64) NOT NULL,

    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    updated_at      TIMESTAMPTZ DEFAULT NULL
);

ALTER TABLE files
    ADD CONSTRAINT chk_files_size_positive
        CHECK (size_bytes > 0),
    ADD CONSTRAINT chk_files_sha256_format
        CHECK (sha256_hex ~ '^[a-f0-9]{64}$'),
    ADD CONSTRAINT chk_files_folder_starts_with_slash
        CHECK (folder ~ '^/'),
    ADD CONSTRAINT chk_files_names_not_blank
        CHECK (LENGTH(TRIM(original_name)) > 0 AND LENGTH(TRIM(current_name)) > 0);

CREATE INDEX idx_files_folder      ON files(folder);
CREATE INDEX idx_files_owner_id    ON files(owner_id);
CREATE INDEX idx_files_created_at  ON files(created_at);
CREATE INDEX idx_files_sha256      ON files(sha256_hex);

CREATE TRIGGER trg_files_updated_at
    BEFORE UPDATE ON files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ─────────────────────────────────────────────────────────────
-- Files Audit
-- ─────────────────────────────────────────────────────────────
-- CREATE TABLE files_audit (
--     audit_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

--     -- Subject (denormalized + FK; FK becomes NULL if file is deleted)
--     file_id       UUID NOT NULL,
--     file_id_fk    UUID REFERENCES files(file_id) ON DELETE SET NULL,

--     -- Actor
--     actor_id        UUID REFERENCES users(user_id) ON DELETE SET NULL,
--     actor_type      VARCHAR(10) NOT NULL CHECK (actor_type IN ('user', 'admin', 'system')),

--     -- Event
--     action          files_audit_action NOT NULL,
--     outcome         VARCHAR(10) NOT NULL CHECK (outcome IN ('success', 'denied', 'error')),
--     denial_reason   VARCHAR(100) DEFAULT NULL,

--     -- Delta
--     old_value       JSONB DEFAULT NULL,
--     new_value       JSONB DEFAULT NULL,

--     -- Snapshot of file state at event time (survives file deletion/rename)
--     file_key_snap TEXT NOT NULL,
--     name_snap       TEXT NOT NULL,
--     folder_snap     TEXT NOT NULL,
--     size_bytes_snap BIGINT NOT NULL,
--     sha256_snap     CHAR(64) NOT NULL,

--     created_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
-- );

-- ALTER TABLE files_audit
--     ADD CONSTRAINT chk_files_audit_denial_reason
--         CHECK (
--             (outcome = 'success' AND denial_reason IS NULL)
--             OR
--             (outcome != 'success' AND denial_reason IS NOT NULL)
--         ),
--     ADD CONSTRAINT chk_files_audit_actor_consistency
--         CHECK (actor_type != 'user' OR actor_id IS NOT NULL),
--     ADD CONSTRAINT chk_files_audit_upload_has_new_value
--         CHECK (action != 'file_uploaded' OR new_value IS NOT NULL),
--     ADD CONSTRAINT chk_files_audit_mutation_has_both_values
--         CHECK (
--             action NOT IN ('file_renamed', 'file_moved', 'mime_type_changed',
--                            'file_overwritten', 'ownership_transferred')
--             OR (old_value IS NOT NULL AND new_value IS NOT NULL)
--         ),
--     ADD CONSTRAINT chk_files_audit_size_snap_positive
--         CHECK (size_bytes_snap > 0),
--     ADD CONSTRAINT chk_files_audit_sha256_snap_format
--         CHECK (sha256_snap ~ '^[a-f0-9]{64}$');

-- CREATE INDEX idx_files_audit_file_id      ON files_audit(file_id);
-- CREATE INDEX idx_files_audit_actor_id       ON files_audit(actor_id) WHERE actor_id IS NOT NULL;
-- CREATE INDEX idx_files_audit_action         ON files_audit(action);
-- CREATE INDEX idx_files_audit_created_at     ON files_audit(created_at DESC);
-- CREATE INDEX idx_files_audit_outcome        ON files_audit(outcome) WHERE outcome != 'success';
-- CREATE INDEX idx_files_audit_sha256         ON files_audit(sha256_snap);
-- CREATE INDEX idx_files_audit_file_activity  ON files_audit(file_id, created_at DESC);
-- CREATE INDEX idx_files_audit_actor_activity ON files_audit(actor_id, created_at DESC)
--                                             WHERE actor_id IS NOT NULL;

-- CREATE TRIGGER trg_files_audit_immutable
--     BEFORE UPDATE OR DELETE ON files_audit
--     FOR EACH ROW EXECUTE FUNCTION fn_audit_immutable();


