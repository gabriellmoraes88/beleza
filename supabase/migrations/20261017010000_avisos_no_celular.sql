-- Avisos no celular (Web Push) para quem trabalha no studio. Só o servidor,
-- com a chave secreta, lê e grava estas tabelas.

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  studio_id   uuid not null references public.studios (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  endpoint    text not null unique check (char_length(endpoint) <= 1000),
  p256dh      text not null check (char_length(p256dh) <= 200),
  auth        text not null check (char_length(auth) <= 100),
  user_agent  text check (char_length(user_agent) <= 300),
  created_at  timestamptz not null default now()
);
create index push_subscriptions_studio_idx on public.push_subscriptions (studio_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

-- Chaves geradas pelo próprio sistema (ex.: par VAPID dos avisos). Sem acesso
-- pelo navegador.
create table public.app_secrets (
  name        text primary key,
  value       jsonb not null,
  created_at  timestamptz not null default now()
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;
