-- File: backend/src/prisma/migrations/20260205222656_add_navigation_permissions/migration.sql
-- Purpose: Create navigation, permissions, and feature flags tables
-- Why: Provides database schema for dynamic navigation system

-- ============================================================================
-- Permissions System
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role TEXT NOT NULL,
    permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON public.role_permissions(permission_id);

-- ============================================================================
-- Navigation Items
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.navigation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role TEXT NOT NULL,
    label TEXT NOT NULL,
    path TEXT NOT NULL,
    icon_name TEXT NOT NULL,
    required_permission TEXT,
    order_index INTEGER DEFAULT 0,
    badge_source TEXT,
    parent_id UUID REFERENCES public.navigation_items(id),
    is_active BOOLEAN DEFAULT true,
    feature_flag TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_navigation_items_role_active_order 
    ON public.navigation_items(role, is_active, order_index);
CREATE INDEX IF NOT EXISTS idx_navigation_items_parent_id 
    ON public.navigation_items(parent_id) 
    WHERE parent_id IS NOT NULL;

-- ============================================================================
-- Feature Flags
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.feature_flag_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_flag_id UUID NOT NULL REFERENCES public.feature_flags(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(feature_flag_id, role)
);

CREATE INDEX IF NOT EXISTS idx_feature_flag_roles_feature_flag_id 
    ON public.feature_flag_roles(feature_flag_id);
CREATE INDEX IF NOT EXISTS idx_feature_flag_roles_role 
    ON public.feature_flag_roles(role);

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE public.permissions IS 'Stores permission keys for RBAC';
COMMENT ON TABLE public.role_permissions IS 'Links permissions to roles';
COMMENT ON TABLE public.navigation_items IS 'Navigation configuration per role';
COMMENT ON TABLE public.feature_flags IS 'Feature toggle configuration';
COMMENT ON TABLE public.feature_flag_roles IS 'Links feature flags to roles';

COMMENT ON COLUMN public.navigation_items.required_permission IS 'Must match permissions.key';
COMMENT ON COLUMN public.navigation_items.feature_flag IS 'Must match feature_flags.key';
COMMENT ON COLUMN public.navigation_items.badge_source IS 'One of: notifications, assignments, submissions';
