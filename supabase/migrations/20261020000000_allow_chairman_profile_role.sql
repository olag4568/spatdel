-- Allow approved SPATDEL community chairmen to have a dedicated profile role.
-- Replace only an existing role-value check constraint, if one is present.
do $$
declare
  existing_constraint text;
begin
  for existing_constraint in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.profiles'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%role%'
      and (
        pg_get_constraintdef(c.oid) ilike '%tenant%'
        or pg_get_constraintdef(c.oid) ilike '%landlord%'
      )
  loop
    execute format(
      'alter table public.profiles drop constraint %I',
      existing_constraint
    );
  end loop;
end;
$$;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('tenant', 'agent', 'landlord', 'chairman', 'admin'));
