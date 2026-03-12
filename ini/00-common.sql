-- =============================================================
-- Shared trigger functions are defined here first so subsequent
-- scripts can reference them safely.
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- Shared trigger: auto-update updated_at on any table
-- Named update_updated_at() — single canonical definition.
-- All other scripts reference this; do NOT redefine it.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW() AT TIME ZONE 'utc';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- CREATE OR REPLACE FUNCTION fn_audit_immutable()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     RAISE EXCEPTION 'Audit table "%" is append-only — UPDATE and DELETE are not permitted.',
--         TG_TABLE_NAME;
-- END;
-- $$ LANGUAGE plpgsql;


-- ─────────────────────────────────────────────────────────────
-- Shared types and enums.
-- ─────────────────────────────────────────────────────────────
-- CREATE TYPE op_outcome AS ENUM ('success', 'denied', 'error');

-- CREATE TYPE actor_type AS ENUM ('user', 'admin', 'system');

-- CREATE TYPE membership AS ENUM ('admin', 'member');






