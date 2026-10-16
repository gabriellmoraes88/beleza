-- Serviços por profissional. Uma profissional sem nenhum serviço marcado faz
-- todos (é o padrão, e mantém como estava quem já usa o sistema). Com serviços
-- marcados, ela só aparece para a cliente quando faz todos os serviços escolhidos.

create table public.professional_services (
  studio_id        uuid not null,
  professional_id  uuid not null,
  service_id       uuid not null,
  primary key (professional_id, service_id),
  foreign key (studio_id, professional_id) references public.professionals (studio_id, id) on delete cascade,
  foreign key (studio_id, service_id) references public.services (studio_id, id) on delete cascade
);
create index professional_services_studio_idx on public.professional_services (studio_id);
alter table public.professional_services enable row level security;

-- Leitura para membros; escrita só pela função set_professional_services.
revoke all on public.professional_services from anon, authenticated;
grant select on public.professional_services to authenticated;
create policy professional_services_select on public.professional_services for select to authenticated
  using ((select public.is_studio_member(studio_id)));

-- A profissional faz todos os serviços da lista?
create function public._professional_does(p_professional_id uuid, p_service_ids uuid[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_service_ids is null
      or not exists (select 1 from public.professional_services ps where ps.professional_id = p_professional_id)
      or not exists (
        select 1 from unnest(p_service_ids) s
        where not exists (
          select 1 from public.professional_services ps
          where ps.professional_id = p_professional_id and ps.service_id = s
        )
      );
$$;

-- Horários livres de uma profissional, ou de qualquer uma que faça os serviços.
drop function public._available_slots_for(uuid, uuid, integer, date);
create function public._available_slots_for(
  p_studio_id uuid, p_professional_id uuid, p_duration_minutes integer, p_date date,
  p_service_ids uuid[] default null
) returns setof timestamptz
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_professional_id is not null then
    if not exists (
      select 1 from public.professionals
      where id = p_professional_id and studio_id = p_studio_id and active
    ) or not public._professional_does(p_professional_id, p_service_ids) then
      return;
    end if;
    return query select * from public._available_slots(p_studio_id, p_professional_id, p_duration_minutes, p_date);
    return;
  end if;

  return query
    select distinct s
    from public._bookable_professionals(p_studio_id) p,
         lateral public._available_slots(p_studio_id, p, p_duration_minutes, p_date) s
    where public._professional_does(p, p_service_ids)
    order by s;
end;
$$;

-- Página pública: cada profissional vem com os serviços que faz (null = todos).
create or replace function public.get_public_studio(p_slug text) returns jsonb
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
    ), '[]'::jsonb),
    'photos', coalesce((
      select jsonb_agg(ph.path order by ph.sort_order, ph.created_at)
      from public.studio_photos ph
      where ph.studio_id = st.id
    ), '[]'::jsonb),
    'professionals', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', pr.id,
               'name', pr.name,
               'service_ids', (select jsonb_agg(ps.service_id) from public.professional_services ps
                               where ps.professional_id = pr.id))
             order by pr.sort_order, pr.created_at)
      from public.professionals pr
      where pr.id in (select public._bookable_professionals(st.id))
    ), '[]'::jsonb)
  )
  from public.studios st
  where st.slug = lower(p_slug);
$$;

create or replace function public.get_available_slots_multi(
  p_slug text, p_service_ids uuid[], p_date date, p_professional_id uuid default null
) returns setof timestamptz
language plpgsql stable security definer set search_path = '' as $$
declare
  v_studio uuid;
  v_duration integer;
begin
  select st.id into v_studio from public.studios st where st.slug = lower(p_slug);
  if v_studio is null or not public.studio_has_access(v_studio) then
    return;
  end if;

  begin
    select r.duration into v_duration from public._resolve_public_services(v_studio, p_service_ids) r;
  exception when others then
    return;
  end;

  return query select * from public._available_slots_for(v_studio, p_professional_id, v_duration, p_date, p_service_ids);
end;
$$;

create or replace function public.book_appointment_multi(
  p_slug text, p_service_ids uuid[], p_starts_at timestamptz,
  p_customer_name text, p_customer_phone text, p_customer_note text default null,
  p_professional_id uuid default null
) returns table (token text, status public.appointment_status)
language plpgsql security definer set search_path = '' as $$
declare
  v_studio public.studios%rowtype;
  v_svc record;
  v_candidates uuid[];
  v_cand uuid;
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

  select * into v_svc from public._resolve_public_services(v_studio.id, p_service_ids);
  v_local_date := (p_starts_at at time zone v_studio.timezone)::date;

  -- Limite simples contra abuso: até 3 agendamentos futuros ativos por telefone.
  if (
    select count(*) from public.appointments a
    join public.customers c on c.id = a.customer_id
    where a.studio_id = v_studio.id and c.phone = p_customer_phone
      and a.status in ('pending', 'confirmed') and a.starts_at > now()
  ) >= 3 then
    raise exception 'TOO_MANY_BOOKINGS';
  end if;

  if p_professional_id is not null then
    if p_professional_id not in (select public._bookable_professionals(v_studio.id))
       or not public._professional_does(p_professional_id, p_service_ids) then
      raise exception 'SLOT_UNAVAILABLE';
    end if;
    v_candidates := array[p_professional_id];
  else
    -- "Qualquer profissional": entre quem faz os serviços, quem tem menos
    -- agendamentos no dia vem primeiro.
    select array_agg(p order by (
             select count(*) from public.appointments a
             where a.professional_id = p and a.status <> 'canceled'
               and (a.starts_at at time zone v_studio.timezone)::date = v_local_date
           ), ord)
      into v_candidates
    from public._bookable_professionals(v_studio.id) with ordinality as b(p, ord)
    where public._professional_does(p, p_service_ids);
  end if;

  v_customer := public._upsert_customer(v_studio.id, p_customer_name, p_customer_phone, p_starts_at);
  v_status := case when v_studio.auto_confirm then 'confirmed' else 'pending' end;

  foreach v_cand in array coalesce(v_candidates, '{}') loop
    -- Serializa agendamentos do mesmo profissional. Com vários candidatos, quem
    -- está ocupado por outra reserva no mesmo instante é pulado (sem espera
    -- cruzada); a restrição de sobreposição continua sendo a garantia final.
    if cardinality(v_candidates) = 1 then
      perform pg_advisory_xact_lock(hashtextextended(v_cand::text, 0));
    elsif not pg_try_advisory_xact_lock(hashtextextended(v_cand::text, 0)) then
      continue;
    end if;

    if exists (
      select 1 from public._available_slots(v_studio.id, v_cand, v_svc.duration, v_local_date) s
      where s = p_starts_at
    ) then
      begin
        insert into public.appointments (
          studio_id, professional_id, service_id, customer_id, starts_at, ends_at,
          status, source, service_name, price_cents, customer_note
        ) values (
          v_studio.id, v_cand, v_svc.first_id, v_customer, p_starts_at,
          p_starts_at + make_interval(mins => v_svc.duration),
          v_status, 'online', v_svc.names, v_svc.price, nullif(trim(p_customer_note), '')
        ) returning public_token into v_token;
        return query select v_token, v_status;
        return;
      exception when exclusion_violation then
        null; -- outro agendamento ocupou este profissional; tenta o próximo
      end;
    end if;
  end loop;

  raise exception 'SLOT_UNAVAILABLE';
end;
$$;

-- Painel: grava os serviços de uma profissional. Lista vazia ou com todos os
-- serviços = faz todos. Só a proprietária.
create function public.set_professional_services(p_professional_id uuid, p_service_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_studio uuid;
begin
  select studio_id into v_studio from public.professionals where id = p_professional_id;
  if v_studio is null or not public.is_studio_owner(v_studio) then
    raise exception 'FORBIDDEN';
  end if;
  if not public.studio_has_access(v_studio) then
    raise exception 'STUDIO_UNAVAILABLE';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_service_ids, '{}')) s
    where not exists (select 1 from public.services sv where sv.id = s and sv.studio_id = v_studio)
  ) then
    raise exception 'SERVICE_NOT_FOUND';
  end if;

  delete from public.professional_services where professional_id = p_professional_id;

  -- Marcou todos os serviços ativos: guarda como "todos", assim serviços novos já valem.
  if cardinality(coalesce(p_service_ids, '{}')) = 0 or not exists (
    select 1 from public.services sv
    where sv.studio_id = v_studio and sv.active and sv.id <> all (p_service_ids)
  ) then
    return;
  end if;

  insert into public.professional_services (studio_id, professional_id, service_id)
  select distinct v_studio, p_professional_id, s from unnest(p_service_ids) s;
end;
$$;

revoke execute on function public._professional_does(uuid, uuid[]) from public, anon, authenticated;
revoke execute on function public._available_slots_for(uuid, uuid, integer, date, uuid[]) from public, anon, authenticated;
revoke execute on function public.set_professional_services(uuid, uuid[]) from public, anon;
grant execute on function public.set_professional_services(uuid, uuid[]) to authenticated;
