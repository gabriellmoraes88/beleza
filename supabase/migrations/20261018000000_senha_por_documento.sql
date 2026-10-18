-- Recuperar senha com e-mail + CPF/CNPJ (sem depender de envio de e-mail).
-- Guardamos só um hash do documento (scrypt com sal, calculado no servidor),
-- nunca o número em texto. Só o servidor, com a chave secreta, lê e grava.

create table public.account_documents (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  doc_hash    text not null check (char_length(doc_hash) <= 200),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger account_documents_updated_at before update on public.account_documents
  for each row execute function public.set_updated_at();
alter table public.account_documents enable row level security;
revoke all on public.account_documents from anon, authenticated;

-- Acha a conta pelo e-mail. Só o servidor pode chamar.
create function public.user_id_by_email(p_email text) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;
revoke execute on function public.user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.user_id_by_email(text) to service_role;

-- Contagem de tentativas recentes (limite contra chute de CPF/CNPJ).
create index audit_log_action_created_idx on public.audit_log (action, created_at);
