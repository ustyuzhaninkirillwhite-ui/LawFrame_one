FROM postgres:16-alpine

WORKDIR /workspace

COPY scripts/bootstrap-local-supabase-compat.sql scripts/bootstrap-local-supabase-compat.sql
COPY supabase/migrations supabase/migrations
COPY supabase/seed supabase/seed
