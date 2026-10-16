-- =============================================================================
-- Beleza: schema inicial multi-tenant
--
-- Princípios:
--   * Todo dado de negócio pertence a um studio (studio_id) e é protegido por RLS.
--   * O cliente final (anon) NÃO acessa tabelas diretamente; ele usa apenas
--     funções security definer que devolvem o mínimo necessário.
--   * Conflito de horário é impedido no banco por uma constraint de exclusão,
--     e o agendamento público é validado e gravado numa única transação.
--   * Assinaturas/pagamentos só são escritos pelo servidor (service_role).
-- =============================================================================

create extension if not exists btree_gist with schema extensions;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.member_role as enum ('owner', 'staff');
create type public.appointment_status as enum ('pending', 'confirmed', 'completed', 'canceled', 'no_show');
create type public.appointment_source as enum ('online', 'manual');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'expired');

-- -----------------------------------------------------------------------------
-- Utilitário: updated_at automático
-- -----------------------------------------------------------------------------
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Planos
-- -----------------------------------------------------------------------------
create table public.plans (
  code         text primary key,
  name         text not null,
  price_cents  integer not null check (price_cents >= 0),
  trial_days   integer not null default 14 check (trial_days between 0 and 90),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

insert into public.plans (code, name, price_cents, trial_days)
values ('studio', 'Plano Studio', 4990, 14);

-- -----------------------------------------------------------------------------
-- Studios (tenant)
-- -----------------------------------------------------------------------------
create table public.studios (
  id                       uuid primary key default gen_random_uuid(),
  slug                     text not null unique
                           check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 40),
  name                     text not null check (char_length(name) between 2 and 80),
  owner_name               text check (char_length(owner_name) <= 80),
  phone                    text check (phone ~ '^[0-9]{10,13}$'),
  whatsapp                 text check (whatsapp ~ '^[0-9]{10,13}$'),
  address                  text check (char_length(address) <= 200),
  city                     text check (char_length(city) <= 80),
  show_address             boolean not null default true,
  description              text check (char_length(description) <= 500),
  instagram                text check (char_length(instagram) <= 60),
  logo_url                 text check (char_length(logo_url) <= 500),
  primary_color            text not null default '#db2777' check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  timezone                 text not null default 'America/Sao_Paulo',
  auto_confirm             boolean not null default true,
  slot_interval_minutes    integer not null default 15 check (slot_interval_minutes between 5 and 120),
  min_advance_minutes      integer not null default 60 check (min_advance_minutes between 0 and 10080),
  max_advance_days         integer not null default 60 check (max_advance_days between 1 and 365),
  cancel_limit_hours       integer not null default 2 check (cancel_limit_hours between 0 and 168),
  onboarding_completed_at  timestamptz,
  suspended_at             timestamptz,
  suspended_reason         text,
  created_by               uuid references auth.users (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create trigger studios_updated_at before update on public.studios
  for each row execute function public.set_updated_at();

create table public.studio_members (
  studio_id   uuid not null references public.studios (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        public.member_role not null default 'owner',
  created_at  timestamptz not null default now(),
  primary key (studio_id, user_id)
);
create index studio_members_user_idx on public.studio_members (user_id);

-- Profissionais: no MVP cada studio tem 1, mas o modelo já suporta equipe.
create table public.professionals (
  id          uuid primary key default gen_random_uuid(),
  studio_id   uuid not null references public.studios (id) on delete cascade,
  user_id     uuid references auth.users (id) on delete set null,
  name        text not null check (char_length(name) between 1 and 80),
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (studio_id, id)
);

create table public.services (
  id                uuid primary key default gen_random_uuid(),
  studio_id         uuid not null references public.studios (id) on delete cascade,
  name              text not null check (char_length(name) between 2 and 80),
  description       text check (char_length(description) <= 300),
  duration_minutes  integer not null check (duration_minutes between 5 and 600),
  price_cents       integer not null default 0 check (price_cents >= 0),
  active            boolean not null default true,
  is_public         boolean not null default true,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (studio_id, id)
);
create trigger services_updated_at before update on public.services
  for each row execute function public.set_updated_at();

-- Horário de trabalho semanal. Vários intervalos por dia representam pausas
-- (ex.: 09:00-12:00 e 13:00-19:00 = almoço das 12h às 13h).
create table public.working_hours (
  id               uuid primary key default gen_random_uuid(),
  studio_id        uuid not null,
  professional_id  uuid not null,
  weekday          smallint not null check (weekday between 0 and 6), -- 0 = domingo
  start_time       time not null,
  end_time         time not null,
  check (end_time > start_time),
  foreign key (studio_id, professional_id) references public.professionals (studio_id, id) on delete cascade
);
create index working_hours_prof_idx on public.working_hours (professional_id, weekday);

-- Bloqueios, folgas, férias e feriados. professional_id nulo = studio inteiro.
create table public.time_blocks (
  id               uuid primary key default gen_random_uuid(),
  studio_id        uuid not null references public.studios (id) on delete cascade,
  professional_id  uuid,
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  reason           text check (char_length(reason) <= 120),
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (studio_id, professional_id) references public.professionals (studio_id, id) on delete cascade
);
create index time_blocks_range_idx on public.time_blocks using gist (studio_id, tstzrange(starts_at, ends_at, '[)'));

-- Clientes do studio, identificados pelo telefone normalizado (só dígitos, com DDI).
create table public.customers (
  id                uuid primary key default gen_random_uuid(),
  studio_id         uuid not null references public.studios (id) on delete cascade,
  name              text not null check (char_length(name) between 2 and 80),
  phone             text not null check (phone ~ '^[0-9]{10,13}$'),
  notes             text check (char_length(notes) <= 1000),
  first_booking_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (studio_id, phone),
  unique (studio_id, id)
);
create trigger customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

create table public.appointments (
  id                uuid primary key default gen_random_uuid(),
  studio_id         uuid not null references public.studios (id) on delete cascade,
  professional_id   uuid not null,
  service_id        uuid,
  customer_id       uuid not null,
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  status            public.appointment_status not null default 'confirmed',
  source            public.appointment_source not null default 'online',
  service_name      text not null,
  price_cents       integer not null default 0,
  customer_note     text check (char_length(customer_note) <= 500),
  internal_note     text check (char_length(internal_note) <= 1000),
  public_token      text not null unique
                    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  canceled_at       timestamptz,
  canceled_by       text check (canceled_by in ('studio', 'customer')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (studio_id, professional_id) references public.professionals (studio_id, id),
  foreign key (studio_id, service_id) references public.services (studio_id, id) on delete set null (service_id),
  foreign key (studio_id, customer_id) references public.customers (studio_id, id),
  -- Garantia final contra horário duplicado: dois agendamentos ativos do mesmo
  -- profissional não podem se sobrepor, mesmo com requisições simultâneas.
  constraint appointments_no_overlap exclude using gist (
    professional_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status <> 'canceled')
);
create index appointments_studio_start_idx on public.appointments (studio_id, starts_at);
create index appointments_customer_idx on public.appointments (customer_id);
create trigger appointments_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Assinaturas e pagamentos (Asaas). IDs externos ficam em colunas próprias.
-- -----------------------------------------------------------------------------
create table public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  studio_id              uuid not null unique references public.studios (id) on delete cascade,
  plan_code              text not null references public.plans (code),
  status                 public.subscription_status not null default 'trialing',
  trial_ends_at          timestamptz,
  current_period_end     timestamptz,
  grace_until            timestamptz,
  canceled_at            timestamptz,
  asaas_customer_id      text unique,
  asaas_subscription_id  text unique,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table public.payments (
  id                uuid primary key default gen_random_uuid(),
  studio_id         uuid not null references public.studios (id) on delete cascade,
  subscription_id   uuid references public.subscriptions (id) on delete set null,
  asaas_payment_id  text not null unique,
  status            text not null,
  billing_type      text,
  value_cents       integer not null,
  due_date          date,
  paid_at           timestamptz,
  invoice_url       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index payments_studio_idx on public.payments (studio_id, due_date desc);
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- Caixa de entrada dos webhooks: o id do evento garante idempotência.
create table public.asaas_webhook_events (
  id            text primary key,
  event         text not null,
  payload       jsonb not null,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  attempts      integer not null default 0,
  last_error    text
);
create index asaas_webhook_events_pending_idx on public.asaas_webhook_events (received_at)
  where processed_at is null;

-- -----------------------------------------------------------------------------
-- Administração da plataforma
-- -----------------------------------------------------------------------------
create table public.platform_admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references auth.users (id) on delete set null,
  action      text not null,
  studio_id   uuid references public.studios (id) on delete set null,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- =============================================================================
-- Funções auxiliares de autorização
-- =============================================================================
create function public.is_studio_member(p_studio_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.studio_members m
    where m.studio_id = p_studio_id and m.user_id = (select auth.uid())
  );
$$;

-- O studio pode operar? (teste ativo, assinatura em dia, tolerância ou período pago)
create function public.studio_has_access(p_studio_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select st.suspended_at is null and case s.status
      when 'trialing' then s.trial_ends_at > now()
      when 'active'   then s.current_period_end is null or s.current_period_end > now()
                           or coalesce(s.grace_until > now(), false)
      when 'past_due' then coalesce(s.grace_until > now(), false)
      when 'canceled' then coalesce(s.current_period_end > now(), false)
      else false
    end
    from public.studios st
    join public.subscriptions s on s.studio_id = st.id
    where st.id = p_studio_id
  ), false);
$$;

create function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.plans                 enable row level security;
alter table public.studios               enable row level security;
alter table public.studio_members        enable row level security;
alter table public.professionals         enable row level security;
alter table public.services              enable row level security;
alter table public.working_hours         enable row level security;
alter table public.time_blocks           enable row level security;
alter table public.customers             enable row level security;
alter table public.appointments          enable row level security;
alter table public.subscriptions         enable row level security;
alter table public.payments              enable row level security;
alter table public.asaas_webhook_events  enable row level security;
alter table public.platform_admins       enable row level security;
alter table public.audit_log             enable row level security;

-- Começa sem nenhum privilégio para anon/authenticated e libera só o necessário.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.plans to anon, authenticated;
create policy plans_read on public.plans for select using (active);

-- studios: membro lê e edita somente colunas de configuração.
grant select on public.studios to authenticated;
grant update (
  slug, name, owner_name, phone, whatsapp, address, city, show_address, description,
  instagram, logo_url, primary_color, auto_confirm, slot_interval_minutes,
  min_advance_minutes, max_advance_days, cancel_limit_hours, onboarding_completed_at
) on public.studios to authenticated;
create policy studios_select on public.studios for select to authenticated
  using ((select public.is_studio_member(id)));
create policy studios_update on public.studios for update to authenticated
  using ((select public.is_studio_member(id)))
  with check ((select public.is_studio_member(id)) and (select public.studio_has_access(id)));

grant select on public.studio_members to authenticated;
create policy studio_members_select on public.studio_members for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_studio_member(studio_id)));

-- Tabelas operacionais: leitura para membros; escrita para membros com acesso ativo.
grant select, insert, update on public.professionals to authenticated;
create policy professionals_select on public.professionals for select to authenticated
  using ((select public.is_studio_member(studio_id)));
create policy professionals_insert on public.professionals for insert to authenticated
  with check ((select public.is_studio_member(studio_id)) and (select public.studio_has_access(studio_id)));
create policy professionals_update on public.professionals for update to authenticated
  using ((select public.is_studio_member(studio_id)))
  with check ((select public.is_studio_member(studio_id)) and (select public.studio_has_access(studio_id)));

grant select, insert, update, delete on public.services to authenticated;
create policy services_select on public.services for select to authenticated
  using ((select public.is_studio_member(studio_id)));
create policy services_insert on public.services for insert to authenticated
  with check ((select public.is_studio_member(studio_id)) and (select public.studio_has_access(studio_id)));
create policy services_update on public.services for update to authenticated
  using ((select public.is_studio_member(studio_id)))
  with check ((select public.is_studio_member(studio_id)) and (select public.studio_has_access(studio_id)));
create policy services_delete on public.services for delete to authenticated
  using ((select public.is_studio_member(studio_id)) and (select public.studio_has_access(studio_id)));

grant select, insert, update, delete on public.working_hours to authenticated;
create policy working_hours_select on public.working_hours for select to authenticated
  using ((select public.is_studio_member(studio_id)));
create policy working_hours_insert on public.working_hours for insert to authenticated
  with check ((select public.is_studio_member(studio_id)) and (select public.studio_has_access(studio_id)));
create policy working_hours_update on public.working_hours for update to authenticated
  using ((select public.is_studio_member(studio_id)))
  with check ((select public.is_studio_member(studio_id)) and (select public.studio_has_access(studio_id)));
create policy working_hours_delete on public.working_hours for delete to authenticated
  using ((select public.is_studio_member(studio_id)) and (select public.studio_has_access(studio_id)));

grant select, insert, update, delete on public.time_blocks to authenticated;
create policy time_blocks_select on public.time_blocks for select to authenticated
  using ((select public.is_studio_member(studio_id)));
create policy time_blocks_insert on public.time_blocks for insert to authenticated
  with check ((select public.is_studio_member(studio_id)) and (select public.studio_has_access(studio_id)));
create policy time_blocks_update on public.time_blocks for update to authenticated
  using ((select public.is_studio_member(studio_id)))
  with check ((select public.is_studio_member(studio_id)) and (select public.studio_has_access(studio_id)));
create policy time_blocks_delete on public.time_blocks for delete to authenticated
  using ((select public.is_studio_member(studio_id)) and (select public.studio_has_access(studio_id)));

grant select, insert, update on public.customers to authenticated;
create policy customers_select on public.customers for select to authenticated
  using ((select public.is_studio_member(studio_id)));
create policy customers_insert on public.customers for insert to authenticated
  with check ((select public.is_studio_member(studio_id)) and (select public.studio_has_access(studio_id)));
create policy customers_update on public.customers for update to authenticated
  using ((select public.is_studio_member(studio_id)))
  with check ((select public.is_studio_member(studio_id)) and (select public.studio_has_access(studio_id)));

-- Agendamentos não são apagados pelo painel: são cancelados (histórico preservado).
grant select, insert, update on public.appointments to authenticated;
create policy appointments_select on public.appointments for select to authenticated
  using ((select public.is_studio_member(studio_id)));
create policy appointments_insert on public.appointments for insert to authenticated
  with check ((select public.is_studio_member(studio_id)) and (select public.studio_has_access(studio_id)));
create policy appointments_update on public.appointments for update to authenticated
  using ((select public.is_studio_member(studio_id)))
  with check ((select public.is_studio_member(studio_id)) and (select public.studio_has_access(studio_id)));

-- Assinatura e cobranças: somente leitura para o studio. Escrita só pelo servidor.
grant select on public.subscriptions to authenticated;
create policy subscriptions_select on public.subscriptions for select to authenticated
  using ((select public.is_studio_member(studio_id)));

grant select on public.payments to authenticated;
create policy payments_select on public.payments for select to authenticated
  using ((select public.is_studio_member(studio_id)));

-- asaas_webhook_events, platform_admins e audit_log: sem políticas = sem acesso
-- via API. Só a service_role (servidor) lê e escreve.

-- Estatísticas de clientes (respeita o RLS de quem consulta).
create view public.customer_stats with (security_invoker = true) as
  select c.id as customer_id,
         c.studio_id,
         count(a.id) filter (where a.status <> 'canceled')                          as total_appointments,
         count(a.id) filter (where a.status = 'completed')                          as completed_appointments,
         count(a.id) filter (where a.status = 'no_show')                            as no_shows,
         max(a.starts_at) filter (where a.status <> 'canceled' and a.starts_at < now()) as last_visit_at,
         min(a.starts_at) filter (where a.status in ('pending', 'confirmed') and a.starts_at >= now()) as next_visit_at
  from public.customers c
  left join public.appointments a on a.customer_id = c.id
  group by c.id, c.studio_id;
revoke all on public.customer_stats from anon, authenticated;
grant select on public.customer_stats to authenticated;

-- =============================================================================
-- Criação do studio (onboarding)
-- =============================================================================
create function public.create_studio(
  p_name text, p_slug text, p_owner_name text, p_phone text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_studio uuid;
  v_prof uuid;
  v_trial integer;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if exists (select 1 from public.studio_members where user_id = v_user and role = 'owner') then
    raise exception 'ALREADY_HAS_STUDIO';
  end if;

  begin
    insert into public.studios (name, slug, owner_name, phone, whatsapp, created_by)
    values (trim(p_name), lower(trim(p_slug)), nullif(trim(p_owner_name), ''), p_phone, p_phone, v_user)
    returning id into v_studio;
  exception when unique_violation then
    raise exception 'SLUG_TAKEN';
  end;

  insert into public.studio_members (studio_id, user_id, role) values (v_studio, v_user, 'owner');

  insert into public.professionals (studio_id, user_id, name)
  values (v_studio, v_user, coalesce(nullif(trim(p_owner_name), ''), trim(p_name)))
  returning id into v_prof;

  -- Horário sugerido (editável): seg-sex 09-12 e 13-19, sábado 09-15.
  insert into public.working_hours (studio_id, professional_id, weekday, start_time, end_time)
  select v_studio, v_prof, d, t.s, t.e
  from generate_series(1, 5) d,
       (values (time '09:00', time '12:00'), (time '13:00', time '19:00')) t(s, e)
  union all
  select v_studio, v_prof, 6, time '09:00', time '15:00';

  select trial_days into v_trial from public.plans where code = 'studio';
  insert into public.subscriptions (studio_id, plan_code, status, trial_ends_at)
  values (v_studio, 'studio', 'trialing', now() + make_interval(days => coalesce(v_trial, 14)));

  return v_studio;
end;
$$;

-- Substitui o horário semanal de um profissional numa única transação.
-- security invoker: as políticas de RLS acima se aplicam.
create function public.set_working_hours(p_professional_id uuid, p_hours jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_studio uuid;
begin
  select studio_id into v_studio from public.professionals where id = p_professional_id;
  if v_studio is null then
    raise exception 'NOT_FOUND';
  end if;

  delete from public.working_hours where professional_id = p_professional_id;

  insert into public.working_hours (studio_id, professional_id, weekday, start_time, end_time)
  select v_studio, p_professional_id, (h ->> 'weekday')::smallint, (h ->> 'start')::time, (h ->> 'end')::time
  from jsonb_array_elements(p_hours) h;

  -- Intervalos do mesmo dia não podem se sobrepor.
  if exists (
    select 1
    from public.working_hours a
    join public.working_hours b
      on a.professional_id = b.professional_id and a.weekday = b.weekday and a.id < b.id
     and a.start_time < b.end_time and b.start_time < a.end_time
    where a.professional_id = p_professional_id
  ) then
    raise exception 'HOURS_OVERLAP';
  end if;
end;
$$;

-- =============================================================================
-- Disponibilidade e agendamento
-- =============================================================================

-- Horários livres de um profissional em uma data (no fuso do studio).
-- Interna: não é exposta diretamente para anon.
create function public._available_slots(
  p_studio_id uuid, p_professional_id uuid, p_duration_minutes integer, p_date date
) returns setof timestamptz
language sql stable security definer set search_path = '' as $$
  with st as (
    select timezone, slot_interval_minutes, min_advance_minutes, max_advance_days
    from public.studios where id = p_studio_id
  ),
  win as (
    select (p_date + wh.start_time) at time zone st.timezone as ws,
           (p_date + wh.end_time)   at time zone st.timezone as we,
           st.*
    from public.working_hours wh cross join st
    where wh.studio_id = p_studio_id
      and wh.professional_id = p_professional_id
      and wh.weekday = extract(dow from p_date)::int
  ),
  cand as (
    select s as starts_at,
           s + make_interval(mins => p_duration_minutes) as ends_at,
           win.min_advance_minutes, win.max_advance_days, win.timezone
    from win,
         generate_series(win.ws, win.we - make_interval(mins => p_duration_minutes),
                         make_interval(mins => win.slot_interval_minutes)) s
  )
  select distinct c.starts_at
  from cand c
  where c.starts_at >= now() + make_interval(mins => c.min_advance_minutes)
    and p_date <= (now() at time zone c.timezone)::date + c.max_advance_days
    and not exists (
      select 1 from public.appointments a
      where a.professional_id = p_professional_id
        and a.status <> 'canceled'
        and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(c.starts_at, c.ends_at, '[)')
    )
    and not exists (
      select 1 from public.time_blocks b
      where b.studio_id = p_studio_id
        and (b.professional_id is null or b.professional_id = p_professional_id)
        and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(c.starts_at, c.ends_at, '[)')
    )
  order by c.starts_at;
$$;

create function public._default_professional(p_studio_id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.professionals
  where studio_id = p_studio_id and active
  order by sort_order, created_at
  limit 1;
$$;

-- Upsert do cliente pelo telefone normalizado dentro do studio.
create function public._upsert_customer(p_studio_id uuid, p_name text, p_phone text, p_at timestamptz)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  insert into public.customers (studio_id, name, phone, first_booking_at)
  values (p_studio_id, trim(p_name), p_phone, p_at)
  on conflict (studio_id, phone) do update
    set first_booking_at = least(public.customers.first_booking_at, excluded.first_booking_at)
  returning id into v_id;
  return v_id;
end;
$$;

-- Página pública: devolve só o que o cliente precisa ver.
create function public.get_public_studio(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'slug', st.slug,
    'name', st.name,
    'description', st.description,
    'address', case when st.show_address then st.address end,
    'city', case when st.show_address then st.city end,
    'whatsapp', st.whatsapp,
    'instagram', st.instagram,
    'logo_url', st.logo_url,
    'primary_color', st.primary_color,
    'timezone', st.timezone,
    'max_advance_days', st.max_advance_days,
    'accepting_bookings', public.studio_has_access(st.id),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', sv.id, 'name', sv.name, 'description', sv.description,
               'duration_minutes', sv.duration_minutes, 'price_cents', sv.price_cents)
             order by sv.sort_order, sv.name)
      from public.services sv
      where sv.studio_id = st.id and sv.active and sv.is_public
    ), '[]'::jsonb)
  )
  from public.studios st
  where st.slug = lower(p_slug);
$$;

create function public.get_available_slots(p_slug text, p_service_id uuid, p_date date)
returns setof timestamptz
language plpgsql stable security definer set search_path = '' as $$
declare
  v_studio uuid;
  v_duration integer;
begin
  select st.id, sv.duration_minutes into v_studio, v_duration
  from public.studios st
  join public.services sv on sv.studio_id = st.id
  where st.slug = lower(p_slug) and sv.id = p_service_id and sv.active and sv.is_public;

  if v_studio is null or not public.studio_has_access(v_studio) then
    return;
  end if;

  return query
    select * from public._available_slots(v_studio, public._default_professional(v_studio), v_duration, p_date);
end;
$$;

-- Agendamento público: validação + gravação atômicas.
create function public.book_appointment(
  p_slug text, p_service_id uuid, p_starts_at timestamptz,
  p_customer_name text, p_customer_phone text, p_customer_note text default null
) returns table (token text, status public.appointment_status)
language plpgsql security definer set search_path = '' as $$
declare
  v_studio public.studios%rowtype;
  v_service public.services%rowtype;
  v_prof uuid;
  v_customer uuid;
  v_status public.appointment_status;
  v_token text;
  v_local_date date;
begin
  if char_length(trim(coalesce(p_customer_name, ''))) < 2 or char_length(p_customer_name) > 80 then
    raise exception 'INVALID_NAME';
  end if;
  if coalesce(p_customer_phone, '') !~ '^[0-9]{10,13}$' then
    raise exception 'INVALID_PHONE';
  end if;
  if char_length(p_customer_note) > 500 then
    raise exception 'INVALID_NOTE';
  end if;

  select * into v_studio from public.studios where slug = lower(p_slug);
  if v_studio.id is null then
    raise exception 'STUDIO_NOT_FOUND';
  end if;
  if not public.studio_has_access(v_studio.id) then
    raise exception 'STUDIO_UNAVAILABLE';
  end if;

  select * into v_service from public.services
  where id = p_service_id and studio_id = v_studio.id and active and is_public;
  if v_service.id is null then
    raise exception 'SERVICE_NOT_FOUND';
  end if;

  v_prof := public._default_professional(v_studio.id);
  if v_prof is null then
    raise exception 'SLOT_UNAVAILABLE';
  end if;

  -- Serializa agendamentos do mesmo profissional dentro desta transação.
  perform pg_advisory_xact_lock(hashtextextended(v_prof::text, 0));

  v_local_date := (p_starts_at at time zone v_studio.timezone)::date;
  if not exists (
    select 1 from public._available_slots(v_studio.id, v_prof, v_service.duration_minutes, v_local_date) s
    where s = p_starts_at
  ) then
    raise exception 'SLOT_UNAVAILABLE';
  end if;

  -- Limite simples contra abuso: até 3 agendamentos futuros ativos por telefone.
  if (
    select count(*) from public.appointments a
    join public.customers c on c.id = a.customer_id
    where a.studio_id = v_studio.id and c.phone = p_customer_phone
      and a.status in ('pending', 'confirmed') and a.starts_at > now()
  ) >= 3 then
    raise exception 'TOO_MANY_BOOKINGS';
  end if;

  v_customer := public._upsert_customer(v_studio.id, p_customer_name, p_customer_phone, p_starts_at);
  v_status := case when v_studio.auto_confirm then 'confirmed' else 'pending' end;

  begin
    insert into public.appointments (
      studio_id, professional_id, service_id, customer_id, starts_at, ends_at,
      status, source, service_name, price_cents, customer_note
    ) values (
      v_studio.id, v_prof, v_service.id, v_customer, p_starts_at,
      p_starts_at + make_interval(mins => v_service.duration_minutes),
      v_status, 'online', v_service.name, v_service.price_cents, nullif(trim(p_customer_note), '')
    ) returning public_token into v_token;
  exception when exclusion_violation then
    raise exception 'SLOT_UNAVAILABLE';
  end;

  return query select v_token, v_status;
end;
$$;

-- Consulta do agendamento pelo link seguro (token aleatório de 256 bits).
create function public.get_public_appointment(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'status', a.status,
    'starts_at', a.starts_at,
    'ends_at', a.ends_at,
    'service_name', a.service_name,
    'price_cents', a.price_cents,
    'customer_first_name', split_part(c.name, ' ', 1),
    'studio_name', st.name,
    'studio_slug', st.slug,
    'studio_whatsapp', st.whatsapp,
    'studio_address', case when st.show_address then st.address end,
    'timezone', st.timezone,
    'primary_color', st.primary_color,
    'can_cancel', a.status in ('pending', 'confirmed')
                  and a.starts_at > now() + make_interval(hours => st.cancel_limit_hours),
    'cancel_limit_hours', st.cancel_limit_hours
  )
  from public.appointments a
  join public.customers c on c.id = a.customer_id
  join public.studios st on st.id = a.studio_id
  where a.public_token = p_token and char_length(p_token) = 64;
$$;

create function public.cancel_public_appointment(p_token text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  update public.appointments a
     set status = 'canceled', canceled_at = now(), canceled_by = 'customer'
    from public.studios st
   where st.id = a.studio_id
     and a.public_token = p_token
     and char_length(p_token) = 64
     and a.status in ('pending', 'confirmed')
     and a.starts_at > now() + make_interval(hours => st.cancel_limit_hours)
  returning a.id into v_id;
  return v_id is not null;
end;
$$;

-- Agendamento manual pelo painel (ignora horário de funcionamento, mas nunca
-- permite sobreposição).
create function public.create_manual_appointment(
  p_studio_id uuid, p_service_id uuid, p_starts_at timestamptz,
  p_customer_name text, p_customer_phone text, p_internal_note text default null,
  p_professional_id uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_service public.services%rowtype;
  v_prof uuid;
  v_customer uuid;
  v_id uuid;
begin
  if not public.is_studio_member(p_studio_id) then
    raise exception 'FORBIDDEN';
  end if;
  if not public.studio_has_access(p_studio_id) then
    raise exception 'STUDIO_UNAVAILABLE';
  end if;
  if coalesce(p_customer_phone, '') !~ '^[0-9]{10,13}$' then
    raise exception 'INVALID_PHONE';
  end if;

  select * into v_service from public.services where id = p_service_id and studio_id = p_studio_id;
  if v_service.id is null then
    raise exception 'SERVICE_NOT_FOUND';
  end if;

  v_prof := coalesce(p_professional_id, public._default_professional(p_studio_id));
  if not exists (select 1 from public.professionals where id = v_prof and studio_id = p_studio_id) then
    raise exception 'FORBIDDEN';
  end if;

  v_customer := public._upsert_customer(p_studio_id, p_customer_name, p_customer_phone, p_starts_at);

  begin
    insert into public.appointments (
      studio_id, professional_id, service_id, customer_id, starts_at, ends_at,
      status, source, service_name, price_cents, internal_note
    ) values (
      p_studio_id, v_prof, v_service.id, v_customer, p_starts_at,
      p_starts_at + make_interval(mins => v_service.duration_minutes),
      'confirmed', 'manual', v_service.name, v_service.price_cents, nullif(trim(p_internal_note), '')
    ) returning id into v_id;
  exception when exclusion_violation then
    raise exception 'SLOT_UNAVAILABLE';
  end;

  return v_id;
end;
$$;

-- Horários livres para o painel (mesma regra da página pública).
create function public.studio_available_slots(p_studio_id uuid, p_duration_minutes integer, p_date date)
returns setof timestamptz
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_studio_member(p_studio_id) then
    raise exception 'FORBIDDEN';
  end if;
  return query
    select * from public._available_slots(p_studio_id, public._default_professional(p_studio_id), p_duration_minutes, p_date);
end;
$$;

-- =============================================================================
-- Permissões de execução das funções
-- =============================================================================
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.is_studio_member(uuid)       to authenticated;
grant execute on function public.studio_has_access(uuid)      to authenticated;
grant execute on function public.is_platform_admin()          to authenticated;
grant execute on function public.create_studio(text, text, text, text) to authenticated;
grant execute on function public.set_working_hours(uuid, jsonb)        to authenticated;
grant execute on function public.create_manual_appointment(uuid, uuid, timestamptz, text, text, text, uuid) to authenticated;
grant execute on function public.studio_available_slots(uuid, integer, date) to authenticated;

grant execute on function public.get_public_studio(text)                      to anon, authenticated;
grant execute on function public.get_available_slots(text, uuid, date)        to anon, authenticated;
grant execute on function public.book_appointment(text, uuid, timestamptz, text, text, text) to anon, authenticated;
grant execute on function public.get_public_appointment(text)                 to anon, authenticated;
grant execute on function public.cancel_public_appointment(text)              to anon, authenticated;

-- set_updated_at é chamada por triggers; não precisa de grant.
