create extension if not exists pgcrypto;

create or replace function public.app_uuid_v7()
returns uuid
language sql
as $$
  select gen_random_uuid();
$$;

