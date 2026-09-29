'use strict'
const fs = require('fs')
const p = require('path')
const dir = p.join(__dirname, '..', 'supabase', 'migrations')

// Part 1: CREATE missing tables + add tenant_id columns
const part1 = `BEGIN;

CREATE TABLE IF NOT EXISTS public.addon_groups (id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());COMMENT ON TABLE public.addon_groups IS 'TENANT_OWNED';\nCREATE TABLE IF NOT EXISTS public.addons (id TEXT PRIMARY KEY, addon_group_id TEXT NOT NULL REFERENCES public.addon_groups(id), name TEXT NOT NULL DEFAULT '', price NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0), sort_order INTEGER NOT NULL DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());COMMENT ON TABLE public.addons IS 'TENANT_OWNED';\nCREATE TABLE IF NOT EXISTS public.product_addon_groups (product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE, addon_group_id TEXT NOT NULL REFERENCES public.addon_groups(id), is_required BOOLEAN NOT NULL DEFAULT false, min_selection INTEGER NOT NULL DEFAULT 0, max_selection INTEGER NOT NULL DEFAULT -1, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (product_id, addon_group_id));COMMENT ON TABLE public.product_addon_groups IS 'TENANT_OWNED';ALTER TABLE public.addon_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_addon_groups ENABLE ROW LEVEL SECURITY;`

fs.writeFileSync(p.join(dir, '_temp_m067.sql'), part1, 'utf-8')
console.log('Part 1 written')
