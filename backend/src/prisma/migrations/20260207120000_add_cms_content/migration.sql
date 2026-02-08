-- File: backend/src/prisma/migrations/20260207120000_add_cms_content/migration.sql
-- Purpose: Create CMS content tables for marketing pages
-- Why: Provides database-driven marketing content management

-- ============================================================================
-- CMS Page Contents
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cms_page_contents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_key TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cms_page_contents_page_key
    ON public.cms_page_contents(page_key)
    WHERE is_active = true;

-- ============================================================================
-- CMS Sections
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cms_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id UUID NOT NULL REFERENCES public.cms_page_contents(id) ON DELETE CASCADE,
    section_key TEXT NOT NULL,
    label TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(page_id, section_key)
);

CREATE INDEX IF NOT EXISTS idx_cms_sections_page_id_sort ON public.cms_sections(page_id, sort_order);


-- ============================================================================
-- CMS Content Items
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cms_content_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES
    public.cms_sections(id) ON DELETE CASCADE,
    item_key TEXT,
    sort_order INTEGER DEFAULT 0,
    content_type TEXT NOT NULL,
    content_json JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cms_content_items_section_id_sort ON public.cms_content_items(section_id, sort_order) WHERE is_active = true;

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE public.cms_page_contents IS 'Marketing/CMS pages (homepage, about, etc.)';
COMMENT ON TABLE public.cms_sections IS 'Sections within a page (hero, stats, features)';
COMMENT ON TABLE public.cms_content_items IS 'Individual content items within sections';

COMMENT ON COLUMN public.cms_page_contents.page_key IS 'Unique identifier: homepage, about, contact, etc.';
COMMENT ON COLUMN public.cms_sections.section_key IS 'Section identifier: hero, stats, features, values, story';
COMMENT ON COLUMN public.cms_content_items.content_type IS 'Type: hero, stat, feature, value, story_paragraph';
COMMENT ON COLUMN public.cms_content_items.content_json IS 'Flexible JSON structure based on content_type';
