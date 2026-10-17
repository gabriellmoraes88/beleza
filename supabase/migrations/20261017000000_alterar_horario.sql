-- Alterar horário pela cliente: o agendamento muda de horário no mesmo registro
-- (o link continua o mesmo), com a mesma profissional e a mesma duração. Vale o
-- mesmo prazo do cancelamento online.

-- Horários livres, podendo ignorar um agendamento (o que está sendo alterado).
drop function public._available_slots(uuid, uuid, integer, date);
create function public._available_slots(
  p_studio_id uuid, p_professional_id uuid, p_duration_minutes integer, p_date date,
  p_ignore_appointment_id uuid default null
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
        and a.id is distinct from p_ignore_appointment_id
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
revoke execute on function public._available_slots(uuid, uuid, integer, date, uuid) from public, anon, authenticated;

-- Agendamento que a cliente ainda pode alterar (mesma regra do cancelamento online).
create function public._changeable_appointment(p_token text) returns public.appointments
language sql stable security definer set search_path = '' as $$
  select a.*
  from public.appointments a
  join public.studios st on st.id = a.studio_id
  where a.public_token = p_token
    and char_length(p_token) = 64
    and a.status in ('pending', 'confirmed')
    and a.starts_at > now() + make_interval(hours => st.cancel_limit_hours)
    and public.studio_has_access(st.id);
$$;
revoke execute on function public._changeable_appointment(text) from public, anon, authenticated;

create function public.get_reschedule_slots(p_token text, p_date date) returns setof timestamptz
language plpgsql stable security definer set search_path = '' as $$
declare
  v_appt public.appointments;
begin
  v_appt := public._changeable_appointment(p_token);
  if v_appt.id is null then
    return;
  end if;
  return query
    select * from public._available_slots(
      v_appt.studio_id, v_appt.professional_id,
      (extract(epoch from v_appt.ends_at - v_appt.starts_at) / 60)::integer,
      p_date, v_appt.id
    );
end;
$$;

-- Troca o horário. Se o studio confirma manualmente, volta a ficar pendente.
create function public.reschedule_public_appointment(p_token text, p_starts_at timestamptz)
returns public.appointment_status
language plpgsql security definer set search_path = '' as $$
declare
  v_appt public.appointments;
  v_studio public.studios%rowtype;
  v_duration integer;
  v_status public.appointment_status;
begin
  v_appt := public._changeable_appointment(p_token);
  if v_appt.id is null then
    raise exception 'CANNOT_CHANGE';
  end if;

  -- Mesma trava dos agendamentos novos para esta profissional.
  perform pg_advisory_xact_lock(hashtextextended(v_appt.professional_id::text, 0));
  perform 1 from public.appointments where id = v_appt.id for update;

  select * into v_studio from public.studios where id = v_appt.studio_id;
  v_duration := (extract(epoch from v_appt.ends_at - v_appt.starts_at) / 60)::integer;

  if not exists (
    select 1 from public._available_slots(
      v_appt.studio_id, v_appt.professional_id, v_duration,
      (p_starts_at at time zone v_studio.timezone)::date, v_appt.id
    ) s
    where s = p_starts_at
  ) then
    raise exception 'SLOT_UNAVAILABLE';
  end if;

  v_status := case when v_studio.auto_confirm then 'confirmed' else 'pending' end;
  update public.appointments
     set starts_at = p_starts_at,
         ends_at = p_starts_at + make_interval(mins => v_duration),
         status = v_status
   where id = v_appt.id;
  return v_status;
exception when exclusion_violation then
  raise exception 'SLOT_UNAVAILABLE';
end;
$$;

-- Página do agendamento: inclui o limite de dias à frente para a tela de alterar.
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
    'max_advance_days', st.max_advance_days,
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

revoke execute on function public.get_reschedule_slots(text, date) from public;
revoke execute on function public.reschedule_public_appointment(text, timestamptz) from public;
grant execute on function public.get_reschedule_slots(text, date) to anon, authenticated;
grant execute on function public.reschedule_public_appointment(text, timestamptz) to anon, authenticated;
