-- -- =============================================================
-- -- Tables: groups, group_members, groups_audit, 
-- -- =============================================================
-- CREATE TYPE groups_audit_action AS ENUM (
--                         'group_created',
--                         'group_deleted',
--                         'group_restored',
--                         'group_renamed',
--                         'group_description_changed',
--                         'member_added',
--                         'member_removed',
--                         'member_deactivated',
--                         'member_role_changed',
--                         'ownership_transferred',
--                         'storage_quota_changed'
--                     );


-- -- -------------------------------------------------------------
-- -- Groups
-- -- -------------------------------------------------------------
-- CREATE TABLE groups (
--     group_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     name            VARCHAR(255) NOT NULL,
--     description     TEXT,
--     slug            VARCHAR(255) UNIQUE NOT NULL,   -- URL-friendly identifier (e.g. "engineering-team")

--     -- Ownership
--     owner_id        UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,

--     -- Storage
--     storage_quota   BIGINT NOT NULL DEFAULT 10737418240,
--     storage_used    BIGINT NOT NULL DEFAULT 0,

--     -- State
--     is_active       BOOLEAN NOT NULL DEFAULT TRUE,

--     -- Timestamps
--     created_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
--     updated_at      TIMESTAMPTZ DEFAULT NULL
-- );

-- ALTER TABLE groups
--     ADD CONSTRAINT chk_groups_storage_used_non_negative
--         CHECK (storage_used >= 0),
--     ADD CONSTRAINT chk_groups_storage_quota_positive
--         CHECK (storage_quota > 0),
--     ADD CONSTRAINT chk_groups_storage_within_quota
--         CHECK (storage_used <= storage_quota),
--     ADD CONSTRAINT chk_groups_slug_format
--         CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
--     ADD CONSTRAINT chk_groups_name_not_blank
--         CHECK (LENGTH(TRIM(name)) > 0);

-- CREATE INDEX idx_groups_owner_id    ON groups(owner_id);
-- CREATE INDEX idx_groups_slug        ON groups(slug);
-- CREATE INDEX idx_groups_is_active   ON groups(is_active) WHERE is_active = TRUE;

-- CREATE TRIGGER trg_groups_updated_at
--     BEFORE UPDATE ON groups
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- -- -------------------------------------------------------------
-- -- Group Members
-- -- -------------------------------------------------------------
-- CREATE TABLE group_members (
--     membership_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     group_id        UUID NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
--     user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

--     -- Role
--     role            membership NOT NULL DEFAULT 'member',

--     -- Invitation tracking
--     invited_by      UUID REFERENCES users(user_id) ON DELETE SET NULL,
--     joined_at       TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),

--     -- State
--     is_active       BOOLEAN NOT NULL DEFAULT TRUE,
--     deactivated_at  TIMESTAMPTZ DEFAULT NULL,
--     deactivated_by  UUID REFERENCES users(user_id) ON DELETE SET NULL,

--     UNIQUE (group_id, user_id)
-- );

-- ALTER TABLE group_members
--     ADD CONSTRAINT chk_group_members_deactivation_consistency
--         CHECK (
--             (is_active = TRUE  AND deactivated_at IS NULL AND deactivated_by IS NULL)
--             OR
--             (is_active = FALSE AND deactivated_at IS NOT NULL)
--         ),
--     ADD CONSTRAINT chk_group_members_not_self_invite
--         CHECK (invited_by IS NULL OR invited_by != user_id);

-- CREATE INDEX idx_group_members_group_id  ON group_members(group_id);
-- CREATE INDEX idx_group_members_user_id   ON group_members(user_id);
-- CREATE INDEX idx_group_members_role      ON group_members(group_id, role) WHERE is_active = TRUE;
-- CREATE INDEX idx_group_members_active    ON group_members(group_id, user_id) WHERE is_active = TRUE;


-- -- -------------------------------------------------------------
-- -- Prevent deactivating the group owner's membership
-- -- -------------------------------------------------------------
-- CREATE OR REPLACE FUNCTION fn_check_owner_is_member()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     IF NEW.is_active = FALSE THEN
--         IF EXISTS (
--             SELECT 1 FROM groups
--             WHERE group_id = NEW.group_id
--               AND owner_id  = NEW.user_id
--         ) THEN
--             RAISE EXCEPTION 'Cannot deactivate the group owner membership (group_id=%, user_id=%).',
--                 NEW.group_id, NEW.user_id;
--         END IF;
--     END IF;
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- CREATE TRIGGER trg_group_members_check_owner
--     BEFORE UPDATE ON group_members
--     FOR EACH ROW EXECUTE FUNCTION fn_check_owner_is_member();


-- -- -------------------------------------------------------------
-- -- Groups Audit
-- -- -------------------------------------------------------------
-- CREATE TABLE groups_audit (
--     audit_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

--     -- Subject
--     group_id        UUID NOT NULL,
--     group_id_fk     UUID REFERENCES groups(group_id) ON DELETE SET NULL,

--     -- Actor
--     actor_id        UUID REFERENCES users(user_id) ON DELETE SET NULL,
--     actor_type      VARCHAR(10) NOT NULL CHECK (actor_type IN ('user', 'admin', 'system')),

--     -- Affected member (for membership events only)
--     target_user_id  UUID REFERENCES users(user_id) ON DELETE SET NULL,

--     -- Event
--     action          groups_audit_action NOT NULL,
--     outcome         VARCHAR(10) NOT NULL CHECK (outcome IN ('success', 'denied', 'error')),
--     denial_reason   VARCHAR(100) DEFAULT NULL,

--     -- Delta
--     old_value       JSONB DEFAULT NULL,
--     new_value       JSONB DEFAULT NULL,

--     created_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
-- );

-- ALTER TABLE groups_audit
--     ADD CONSTRAINT chk_groups_audit_denial_reason
--         CHECK (
--             (outcome = 'success' AND denial_reason IS NULL)
--             OR
--             (outcome != 'success' AND denial_reason IS NOT NULL)
--         ),
--     ADD CONSTRAINT chk_groups_audit_membership_target
--         CHECK (
--             action NOT IN ('member_added', 'member_removed', 'member_deactivated', 'member_role_changed')
--             OR target_user_id IS NOT NULL
--         ),
--     ADD CONSTRAINT chk_groups_audit_actor_consistency
--         CHECK (actor_type != 'user' OR actor_id IS NOT NULL);

-- CREATE INDEX idx_groups_audit_group_id       ON groups_audit(group_id);
-- CREATE INDEX idx_groups_audit_actor_id       ON groups_audit(actor_id) WHERE actor_id IS NOT NULL;
-- CREATE INDEX idx_groups_audit_target_user    ON groups_audit(target_user_id) WHERE target_user_id IS NOT NULL;
-- CREATE INDEX idx_groups_audit_action         ON groups_audit(action);
-- CREATE INDEX idx_groups_audit_created_at     ON groups_audit(created_at DESC);
-- CREATE INDEX idx_groups_audit_outcome        ON groups_audit(outcome) WHERE outcome != 'success';
-- CREATE INDEX idx_groups_audit_group_activity ON groups_audit(group_id, created_at DESC);
-- CREATE INDEX idx_groups_audit_user_history   ON groups_audit(target_user_id, created_at DESC)
--                                             WHERE target_user_id IS NOT NULL;

-- CREATE TRIGGER trg_groups_audit_immutable
--     BEFORE UPDATE OR DELETE ON groups_audit
--     FOR EACH ROW EXECUTE FUNCTION fn_audit_immutable();


-- -- =============================================================
-- -- Auto-log changes to the `groups` table → groups_audit
-- --
-- -- Covers:
-- --   INSERT → group_created
-- --   UPDATE → group_renamed | group_description_changed
-- --            | group_deleted | group_restored
-- --            | ownership_transferred | storage_quota_changed
-- --   DELETE → group_deleted (hard delete)
-- -- =============================================================

-- CREATE OR REPLACE FUNCTION fn_groups_audit_log()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     -- -------------------------------------------------------------
--     -- INSERT → group_created
--     -- -------------------------------------------------------------
--     IF TG_OP = 'INSERT' THEN
--         INSERT INTO groups_audit (
--             group_id, group_id_fk,
--             actor_id, actor_type,
--             action, outcome,
--             old_value, new_value
--         ) VALUES (
--             NEW.group_id, NEW.group_id,
--             NEW.owner_id, 'user',
--             'group_created', 'success',
--             NULL,
--             jsonb_build_object(
--                 'name',          NEW.name,
--                 'slug',          NEW.slug,
--                 'description',   NEW.description,
--                 'storage_quota', NEW.storage_quota,
--                 'owner_id',      NEW.owner_id
--             )
--         );

--         RETURN NEW;
--     END IF;

--     -- -------------------------------------------------------------
--     -- DELETE → group_deleted (hard delete)
--     -- -------------------------------------------------------------
--     IF TG_OP = 'DELETE' THEN
--         INSERT INTO groups_audit (
--             group_id, group_id_fk,
--             actor_id, actor_type,
--             action, outcome,
--             old_value, new_value
--         ) VALUES (
--             OLD.group_id, NULL,         -- FK will be NULL; parent is gone
--             OLD.owner_id, 'system',
--             'group_deleted', 'success',
--             jsonb_build_object(
--                 'name',      OLD.name,
--                 'slug',      OLD.slug,
--                 'is_active', OLD.is_active
--             ),
--             NULL
--         );

--         RETURN OLD;
--     END IF;

--     -- -------------------------------------------------------------
--     -- UPDATE → one INSERT per changed field/concern
--     -- -------------------------------------------------------------

--     -- Soft delete
--     IF OLD.is_active = TRUE AND NEW.is_active = FALSE THEN
--         INSERT INTO groups_audit (
--             group_id, group_id_fk, actor_id, actor_type,
--             action, outcome, old_value, new_value
--         ) VALUES (
--             NEW.group_id, NEW.group_id, NEW.owner_id, 'user',
--             'group_deleted', 'success',
--             jsonb_build_object('is_active', OLD.is_active),
--             jsonb_build_object('is_active', NEW.is_active)
--         );
--     END IF;

--     -- Restore
--     IF OLD.is_active = FALSE AND NEW.is_active = TRUE THEN
--         INSERT INTO groups_audit (
--             group_id, group_id_fk, actor_id, actor_type,
--             action, outcome, old_value, new_value
--         ) VALUES (
--             NEW.group_id, NEW.group_id, NEW.owner_id, 'user',
--             'group_restored', 'success',
--             jsonb_build_object('is_active', OLD.is_active),
--             jsonb_build_object('is_active', NEW.is_active)
--         );
--     END IF;

--     -- Name changed
--     IF OLD.name <> NEW.name THEN
--         INSERT INTO groups_audit (
--             group_id, group_id_fk, actor_id, actor_type,
--             action, outcome, old_value, new_value
--         ) VALUES (
--             NEW.group_id, NEW.group_id, NEW.owner_id, 'user',
--             'group_renamed', 'success',
--             jsonb_build_object('name', OLD.name),
--             jsonb_build_object('name', NEW.name)
--         );
--     END IF;

--     -- Description changed (coalesce handles NULL comparisons)
--     IF COALESCE(OLD.description, '') <> COALESCE(NEW.description, '') THEN
--         INSERT INTO groups_audit (
--             group_id, group_id_fk, actor_id, actor_type,
--             action, outcome, old_value, new_value
--         ) VALUES (
--             NEW.group_id, NEW.group_id, NEW.owner_id, 'user',
--             'group_description_changed', 'success',
--             jsonb_build_object('description', OLD.description),
--             jsonb_build_object('description', NEW.description)
--         );
--     END IF;

--     -- Ownership transferred
--     IF OLD.owner_id <> NEW.owner_id THEN
--         INSERT INTO groups_audit (
--             group_id, group_id_fk, actor_id, actor_type,
--             action, outcome, old_value, new_value
--         ) VALUES (
--             NEW.group_id, NEW.group_id, OLD.owner_id, 'user',
--             'ownership_transferred', 'success',
--             jsonb_build_object('owner_id', OLD.owner_id),
--             jsonb_build_object('owner_id', NEW.owner_id)
--         );
--     END IF;

--     -- Storage quota changed
--     IF OLD.storage_quota <> NEW.storage_quota THEN
--         INSERT INTO groups_audit (
--             group_id, group_id_fk, actor_id, actor_type,
--             action, outcome, old_value, new_value
--         ) VALUES (
--             NEW.group_id, NEW.group_id, NEW.owner_id, 'admin',
--             'storage_quota_changed', 'success',
--             jsonb_build_object('storage_quota', OLD.storage_quota),
--             jsonb_build_object('storage_quota', NEW.storage_quota)
--         );
--     END IF;

--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;


-- CREATE TRIGGER trg_groups_audit_log
--     AFTER INSERT OR UPDATE OR DELETE ON groups
--     FOR EACH ROW EXECUTE FUNCTION fn_groups_audit_log();


-- -- =============================================================
-- -- Auto-log changes to `group_members` → groups_audit
-- --
-- -- Covers:
-- --   INSERT → member_added
-- --   UPDATE → member_deactivated | member_role_changed
-- --   DELETE → member_removed (hard delete)
-- -- =============================================================

-- CREATE OR REPLACE FUNCTION fn_group_members_audit_log()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     -- -------------------------------------------------------------
--     -- INSERT → member_added
--     -- -------------------------------------------------------------
--     IF TG_OP = 'INSERT' THEN
--         INSERT INTO groups_audit (
--             group_id, group_id_fk,
--             actor_id, actor_type,
--             target_user_id,
--             action, outcome,
--             old_value, new_value
--         ) VALUES (
--             NEW.group_id, NEW.group_id,
--             COALESCE(NEW.invited_by, NEW.user_id), 'user',
--             NEW.user_id,
--             'member_added', 'success',
--             NULL,
--             jsonb_build_object(
--                 'role',       NEW.role,
--                 'invited_by', NEW.invited_by
--             )
--         );

--         RETURN NEW;
--     END IF;

--     -- -------------------------------------------------------------
--     -- DELETE → member_removed (hard delete)
--     -- -------------------------------------------------------------
--     IF TG_OP = 'DELETE' THEN
--         INSERT INTO groups_audit (
--             group_id, group_id_fk,
--             actor_id, actor_type,
--             target_user_id,
--             action, outcome,
--             old_value, new_value
--         ) VALUES (
--             OLD.group_id, OLD.group_id,
--             OLD.user_id, 'system',
--             OLD.user_id,
--             'member_removed', 'success',
--             jsonb_build_object('role', OLD.role),
--             NULL
--         );

--         RETURN OLD;
--     END IF;

--     -- -------------------------------------------------------------
--     -- UPDATE → one INSERT per changed field/concern
--     -- -------------------------------------------------------------

--     -- Member deactivated (soft remove)
--     IF OLD.is_active = TRUE AND NEW.is_active = FALSE THEN
--         INSERT INTO groups_audit (
--             group_id, group_id_fk,
--             actor_id, actor_type,
--             target_user_id,
--             action, outcome,
--             old_value, new_value
--         ) VALUES (
--             NEW.group_id, NEW.group_id,
--             COALESCE(NEW.deactivated_by, NEW.user_id), 'user',
--             NEW.user_id,
--             'member_deactivated', 'success',
--             jsonb_build_object('is_active', OLD.is_active, 'role', OLD.role),
--             jsonb_build_object('is_active', NEW.is_active, 'deactivated_at', NEW.deactivated_at)
--         );
--     END IF;

--     -- Role changed
--     IF OLD.role <> NEW.role THEN
--         INSERT INTO groups_audit (
--             group_id, group_id_fk,
--             actor_id, actor_type,
--             target_user_id,
--             action, outcome,
--             old_value, new_value
--         ) VALUES (
--             NEW.group_id, NEW.group_id,
--             NEW.user_id, 'user',
--             NEW.user_id,
--             'member_role_changed', 'success',
--             jsonb_build_object('role', OLD.role),
--             jsonb_build_object('role', NEW.role)
--         );
--     END IF;

--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;


-- CREATE TRIGGER trg_group_members_audit_log
--     AFTER INSERT OR UPDATE OR DELETE ON group_members
--     FOR EACH ROW EXECUTE FUNCTION fn_group_members_audit_log();