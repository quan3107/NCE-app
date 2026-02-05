-- File: backend/src/prisma/migrations/20260205222657_add_navigation_rls_policies/migration.sql
-- Purpose: Enable RLS and create policies for navigation tables
-- Why: Ensures row-level security for navigation, permissions, and feature flags

-- ============================================================================
-- Enable RLS on all new tables
-- ============================================================================

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.navigation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flag_roles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.navigation_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags FORCE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flag_roles FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- SELECT Policies: Role-based access for authenticated users
-- ============================================================================

-- Navigation items: Users can see items for their role
CREATE POLICY navigation_items_select_for_role
ON public.navigation_items
FOR SELECT
USING (
    current_role = 'service_role'
    OR current_setting('app.current_user_role', true) = 'admin'
    OR role = current_setting('app.current_user_role', true)
);

-- Permissions: Users can see permissions assigned to their role
CREATE POLICY permissions_select_for_role
ON public.permissions
FOR SELECT
USING (
    current_role = 'service_role'
    OR current_setting('app.current_user_role', true) = 'admin'
    OR EXISTS (
        SELECT 1
        FROM public.role_permissions rp
        WHERE rp.permission_id = permissions.id
            AND rp.role = current_setting('app.current_user_role', true)
    )
);

-- Role permissions: Users can see role-permission mappings for their role
CREATE POLICY role_permissions_select_for_role
ON public.role_permissions
FOR SELECT
USING (
    current_role = 'service_role'
    OR current_setting('app.current_user_role', true) = 'admin'
    OR role = current_setting('app.current_user_role', true)
);

-- Feature flags: Users can see flags enabled for their role
CREATE POLICY feature_flags_select_for_role
ON public.feature_flags
FOR SELECT
USING (
    current_role = 'service_role'
    OR current_setting('app.current_user_role', true) = 'admin'
    OR EXISTS (
        SELECT 1
        FROM public.feature_flag_roles fr
        WHERE fr.feature_flag_id = feature_flags.id
            AND fr.role = current_setting('app.current_user_role', true)
    )
);

-- Feature flag roles: Users can see flag-role mappings for their role
CREATE POLICY feature_flag_roles_select_for_role
ON public.feature_flag_roles
FOR SELECT
USING (
    current_role = 'service_role'
    OR current_setting('app.current_user_role', true) = 'admin'
    OR role = current_setting('app.current_user_role', true)
);

-- ============================================================================
-- WRITE Policies: Admin and service role only
-- ============================================================================

-- Navigation items write policies
CREATE POLICY navigation_items_insert_admin
ON public.navigation_items
FOR INSERT
WITH CHECK (
    current_role = 'service_role'
    OR current_setting('app.current_user_role', true) = 'admin'
);

CREATE POLICY navigation_items_update_admin
ON public.navigation_items
FOR UPDATE
USING (
    current_role = 'service_role'
    OR current_setting('app.current_user_role', true) = 'admin'
)
WITH CHECK (
    current_role = 'service_role'
    OR current_setting('app.current_user_role', true) = 'admin'
);

CREATE POLICY navigation_items_delete_admin
ON public.navigation_items
FOR DELETE
USING (
    current_role = 'service_role'
    OR current_setting('app.current_user_role', true) = 'admin'
);

-- Permissions write policies
CREATE POLICY permissions_insert_admin
ON public.permissions
FOR INSERT
WITH CHECK (
    current_role = 'service_role'
    OR current_setting('app.current_user_role', true) = 'admin'
);

CREATE POLICY permissions_update_admin
ON public.permissions
FOR UPDATE
USING (
    current_role = 'service_role'
    OR current_setting('app.current_user_role', true) = 'admin'
)
WITH CHECK (
    current_role = 'service_role'
    OR current_setting('app.current_user_role', true) = 'admin'
);

CREATE POLICY permissions_delete_admin
ON public.permissions
FOR DELETE
USING (
    current_role = 'service_role'
    OR current_setting('app.current_user_role', true) = 'admin'
);

-- Role permissions write policies
CREATE POLICY role_permissions_insert_admin
ON public.role_permissions
FOR INSERT
WITH CHECK (
    current_role = 'service_role'
    OR current_setting('app.current_user_role', true) = 'admin'
);

CREATE POLICY role_permissions_update_admin
ON public.role_permissions
FOR UPDATE
USING (
    current_role = 'service_role'
    OR current_setting('app.current_user_role', true) = 'admin'
)
WITH CHECK (
    current_role = 'service_role'
    OR current_setting('app.current_user_role', true) = 'admin'
);

CREATE POLICY role_permissions_delete_admin
ON public.role_permissions
FOR DELETE
USING (
    current_role = 'service_role'
    OR current_setting('app.current_user_role', true) = 'admin'
);

-- Feature flags write policies
CREATE POLICY feature_flags_insert_admin
ON public.feature_flags
FOR INSERT
WITH CHECK (
    current_role = 'service_role'
    OR current_setting('app.current_user_role', true) = 'admin'
);

CREATE POLICY feature_flags_update_admin
ON public.feature_flags
FOR UPDATE
USING (
    current_role = 'service_role'
    OR current_setting('app.current_user_role', true) = 'admin'
)
WITH CHECK (
    current_role = 'service_role'
    OR current_setting('app.current_user_role', true) = 'admin'
);

CREATE POLICY feature_flags_delete_admin
ON public.feature_flags
FOR DELETE
USING (
    current_role = 'service_role'
    OR current_setting('app.current_user_role', true) = 'admin'
);

-- Feature flag roles write policies
CREATE POLICY feature_flag_roles_insert_admin
ON public.feature_flag_roles
FOR INSERT
WITH CHECK (
    current_role = 'service_role'
    OR current_setting('app.current_user_role', true) = 'admin'
);

CREATE POLICY feature_flag_roles_update_admin
ON public.feature_flag_roles
FOR UPDATE
USING (
    current_role = 'service_role'
    OR current_setting('app.current_user_role', true) = 'admin'
)
WITH CHECK (
    current_role = 'service_role'
    OR current_setting('app.current_user_role', true) = 'admin'
);

CREATE POLICY feature_flag_roles_delete_admin
ON public.feature_flag_roles
FOR DELETE
USING (
    current_role = 'service_role'
    OR current_setting('app.current_user_role', true) = 'admin'
);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON POLICY navigation_items_select_for_role ON public.navigation_items IS 'Allow users to see navigation items for their role';
COMMENT ON POLICY permissions_select_for_role ON public.permissions IS 'Allow users to see permissions assigned to their role';
COMMENT ON POLICY feature_flags_select_for_role ON public.feature_flags IS 'Allow users to see feature flags enabled for their role';
