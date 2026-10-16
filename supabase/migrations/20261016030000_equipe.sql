-- Equipe: vários profissionais por studio. Na página pública a cliente escolhe
-- um profissional ou "qualquer um"; nesse caso o sistema escolhe quem estiver
-- livre, priorizando quem tem menos agendamentos no dia.

-- -----------------------------------------------------------------------------
-- Profissionais que podem receber agendamentos: ativos e com horário cadastrado.
-- -----------------------------------------------------------------------------
create function public._bookable_professionals(p_studio_id uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select p.id from public.professionals p
  where p.studio_id = p_studio_id and p.active
    and exists (select 1 from public.working_hours wh where wh.professional_id = p.id)
  order by p.sort_order, p.created_at;
$$;

-- Horários livres de um profissional, ou de qualquer um (p_professional_id nulo).
create function public._available_slots_for(
  p_studio_id uuid, p_professional_id uuid, p_duration_minutes integer, p_date date
) returns setof timestamptz
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_professional_id is not null then
    if not exists (
      select 1 from public.professionals
      where id = p_professional_id and studio_id = p_studio_id and active
    ) then
      return;
    end if;
    return query select * from public._available_slots(p_studio_id, p_professional_id, p_duration_minutes, p_date);
    return;
  end if;

  return query
    select distinct s
    from public._bookable_professionals(p_studio_id) p,
         lateral public._available_slots(p_studio_id, p, p_duration_minutes, p_date) s
    order by s;
end;
$$;

-- -----------------------------------------------------------------------------
-- Página pública: devolve também a equipe (só id e nome).
-- -----------------------------------------------------------------------------
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
      select jsonb_agg(jsonb_build_object('id', pr.id, 'name', pr.name) order by pr.sort_order, pr.created_at)
      from public.professionals pr
      where pr.id in (select public._bookable_professionals(st.id))
    ), '[]'::jsonb)
  )
  from public.studios st
  where st.slug = lower(p_slug);
$$;

-- Comprovante do agendamento mostra com quem é.
create or replace function public.get_public_appointment(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'status', a.status,
    'starts_at', a.starts_at,
    'ends_at', a.ends_at,
    'service_name', a.service_name,
    'price_cents', a.price_cents,
    'professional_name', pr.name,
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
  join public.professionals pr on pr.id = a.professional_id
  where a.public_token = p_token and char_length(p_token) = 64;
$$;

-- -----------------------------------------------------------------------------
-- Horários e agendamento públicos com escolha do profissional.
-- -----------------------------------------------------------------------------
drop function public.get_available_slots_multi(text, uuid[], date);
create function public.get_available_slots_multi(
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

  return query select * from public._available_slots_for(v_studio, p_professional_id, v_duration, p_date);
end;
$$;

drop function public.book_appointment_multi(text, uuid[], timestamptz, text, text, text);
create function public.book_appointment_multi(
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
    if p_professional_id not in (select public._bookable_professionals(v_studio.id)) then
      raise exception 'SLOT_UNAVAILABLE';
    end if;
    v_candidates := array[p_professional_id];
  else
    -- "Qualquer profissional": quem tem menos agendamentos no dia vem primeiro.
    select array_agg(p order by (
             select count(*) from public.appointments a
             where a.professional_id = p and a.status <> 'canceled'
               and (a.starts_at at time zone v_studio.timezone)::date = v_local_date
           ), ord)
      into v_candidates
    from public._bookable_professionals(v_studio.id) with ordinality as b(p, ord);
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

-- -----------------------------------------------------------------------------
-- Painel: horários livres por profissional (nulo = qualquer um).
-- -----------------------------------------------------------------------------
drop function public.studio_available_slots(uuid, integer, date);
create function public.studio_available_slots(
  p_studio_id uuid, p_duration_minutes integer, p_date date, p_professional_id uuid default null
) returns setof timestamptz
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_studio_member(p_studio_id) then
    raise exception 'FORBIDDEN';
  end if;
  return query select * from public._available_slots_for(p_studio_id, p_professional_id, p_duration_minutes, p_date);
end;
$$;

-- -----------------------------------------------------------------------------
-- Painel: nova profissional, já com o horário da primeira profissional do studio.
-- Só a proprietária gerencia a equipe.
-- -----------------------------------------------------------------------------
create function public.is_studio_owner(p_studio_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.studio_members m
    where m.studio_id = p_studio_id and m.user_id = (select auth.uid()) and m.role = 'owner'
  );
$$;

create function public.add_professional(p_studio_id uuid, p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_template uuid;
begin
  if not public.is_studio_owner(p_studio_id) then
    raise exception 'FORBIDDEN';
  end if;
  if not public.studio_has_access(p_studio_id) then
    raise exception 'STUDIO_UNAVAILABLE';
  end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 80 then
    raise exception 'INVALID_NAME';
  end if;
  if (select count(*) from public.professionals where studio_id = p_studio_id) >= 30 then
    raise exception 'TOO_MANY_PROFESSIONALS';
  end if;

  v_template := public._default_professional(p_studio_id);

  insert into public.professionals (studio_id, name, sort_order)
  values (
    p_studio_id, trim(p_name),
    coalesce((select max(sort_order) + 1 from public.professionals where studio_id = p_studio_id), 0)
  )
  returning id into v_id;

  insert into public.working_hours (studio_id, professional_id, weekday, start_time, end_time)
  select p_studio_id, v_id, wh.weekday, wh.start_time, wh.end_time
  from public.working_hours wh
  where wh.professional_id = v_template;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permissões
-- -----------------------------------------------------------------------------
revoke execute on function public._bookable_professionals(uuid) from public, anon, authenticated;
revoke execute on function public._available_slots_for(uuid, uuid, integer, date) from public, anon, authenticated;
revoke execute on function public.get_available_slots_multi(text, uuid[], date, uuid) from public;
revoke execute on function public.book_appointment_multi(text, uuid[], timestamptz, text, text, text, uuid) from public;
revoke execute on function public.studio_available_slots(uuid, integer, date, uuid) from public, anon;
revoke execute on function public.is_studio_owner(uuid) from public, anon;
revoke execute on function public.add_professional(uuid, text) from public, anon;

grant execute on function public.get_available_slots_multi(text, uuid[], date, uuid) to anon, authenticated;
grant execute on function public.book_appointment_multi(text, uuid[], timestamptz, text, text, text, uuid) to anon, authenticated;
grant execute on function public.studio_available_slots(uuid, integer, date, uuid) to authenticated;
grant execute on function public.is_studio_owner(uuid) to authenticated;
grant execute on function public.add_professional(uuid, text) to authenticated;
