alter table public.account_tokens alter column expires_at drop not null;

update public.account_tokens
   set expires_at = null
 where purpose = 'activation';

alter table public.account_tokens
  add constraint account_tokens_expiry_by_purpose_check
  check ((purpose = 'activation' and expires_at is null) or (purpose = 'password_reset' and expires_at is not null));
