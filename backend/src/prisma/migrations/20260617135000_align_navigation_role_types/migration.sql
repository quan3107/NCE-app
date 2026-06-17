-- File: backend/src/prisma/migrations/20260617135000_align_navigation_role_types/migration.sql
-- Purpose: Align navigation role columns with the Prisma UserRole enum.
-- Why: Prisma emits UserRole enum values for these models, so clean resets need matching column types.

DROP POLICY IF EXISTS navigation_items_select_for_role ON public.navigation_items;
DROP POLICY IF EXISTS permissions_select_for_role ON public.permissions;
DROP POLICY IF EXISTS role_permissions_select_for_role ON public.role_permissions;
DROP POLICY IF EXISTS feature_flags_select_for_role ON public.feature_flags;
DROP POLICY IF EXISTS feature_flag_roles_select_for_role ON public.feature_flag_roles;
DROP POLICY IF EXISTS navigation_items_insert_admin ON public.navigation_items;
DROP POLICY IF EXISTS navigation_items_update_admin ON public.navigation_items;
DROP POLICY IF EXISTS navigation_items_delete_admin ON public.navigation_items;
DROP POLICY IF EXISTS permissions_insert_admin ON public.permissions;
DROP POLICY IF EXISTS permissions_update_admin ON public.permissions;
DROP POLICY IF EXISTS permissions_delete_admin ON public.permissions;
DROP POLICY IF EXISTS role_permissions_insert_admin ON public.role_permissions;
DROP POLICY IF EXISTS role_permissions_update_admin ON public.role_permissions;
DROP POLICY IF EXISTS role_permissions_delete_admin ON public.role_permissions;
DROP POLICY IF EXISTS feature_flags_insert_admin ON public.feature_flags;
DROP POLICY IF EXISTS feature_flags_update_admin ON public.feature_flags;
DROP POLICY IF EXISTS feature_flags_delete_admin ON public.feature_flags;
DROP POLICY IF EXISTS feature_flag_roles_insert_admin ON public.feature_flag_roles;
DROP POLICY IF EXISTS feature_flag_roles_update_admin ON public.feature_flag_roles;
DROP POLICY IF EXISTS feature_flag_roles_delete_admin ON public.feature_flag_roles;

ALTER TABLE public.role_permissions
  ALTER COLUMN role TYPE "UserRole" USING role::"UserRole";

ALTER TABLE public.navigation_items
  ALTER COLUMN role TYPE "UserRole" USING role::"UserRole";

ALTER TABLE public.feature_flag_roles
  ALTER COLUMN role TYPE "UserRole" USING role::"UserRole";

CREATE POLICY navigation_items_select_for_role
ON public.navigation_items
FOR SELECT
USING (
    current_role = 'service_role'
    OR current_setting('app.current_user_role', true) = 'admin'
    OR role::text = current_setting('app.current_user_role', true)
);

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
            AND rp.role::text = current_setting('app.current_user_role', true)
    )
);

CREATE POLICY role_permissions_select_for_role
ON public.role_permissions
FOR SELECT
USING (
    current_role = 'service_role'
    OR current_setting('app.current_user_role', true) = 'admin'
    OR role::text = current_setting('app.current_user_role', true)
);

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
            AND fr.role::text = current_setting('app.current_user_role', true)
    )
);

CREATE POLICY feature_flag_roles_select_for_role
ON public.feature_flag_roles
FOR SELECT
USING (
    current_role = 'service_role'
    OR current_setting('app.current_user_role', true) = 'admin'
    OR role::text = current_setting('app.current_user_role', true)
);

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
