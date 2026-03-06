-- SQL Editor de Supabase:
CREATE TABLE IF NOT EXISTS app_settings (
  id integer PRIMARY KEY,
  company_name text,
  company_logo_url text,
  updated_at timestamptz
);
