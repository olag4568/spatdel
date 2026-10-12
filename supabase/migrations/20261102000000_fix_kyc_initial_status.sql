-- Keep newly-created KYC records in the not_started state.
-- Some deployed environments may have an older default of 'pending'.
alter table public.spatdel_kyc_profiles
  alter column status set default 'not_started';

-- Normalize only untouched placeholder rows that were created as pending.
-- A real request made through the app updates updated_at, so submitted requests
-- are preserved. Any provider/reviewer/verification evidence is also preserved.
update public.spatdel_kyc_profiles
set status = 'not_started'
where status = 'pending'
  and provider is null
  and provider_reference is null
  and verified_at is null
  and reviewed_by is null
  and review_note is null
  and updated_at = created_at;
