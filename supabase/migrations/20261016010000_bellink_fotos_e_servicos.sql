-- Bellink: cor padrão neutra, fotos do studio e vários serviços no mesmo agendamento.

-- -----------------------------------------------------------------------------
-- Cor padrão neutra (grafite) para as páginas públicas dos studios.
-- -----------------------------------------------------------------------------
alter table public.studios alter column primary_color set default '#292524';
update public.studios set primary_color = '#292524' where primary_color in ('#db2777', '#9a5b60');

-- -----------------------------------------------------------------------------
-- Fotos do studio. Os arquivos ficam no bucket público "studio-photos",
-- na pasta <studio_id>/. O envio é feito pelo servidor.
-- -----------------------------------------------------------------------------
create table public.studio_photos (
  id          uuid primary key default gen_random_uuid(),
  studio_id   uuid not null references public.studios (id) on delete cascade,
  path        text not null unique check (path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index studio_photos_studio_idx on public.studio_photos (studio_id, sort_order, created_at);
alter table public.studio_photos enable row level security;

revoke all on public.studio_photos from anon, authenticated;
grant select, insert, update, delete on public.studio_photos to authenticated;
create policy studio_photos_select on public.studio_photos for select to authenticated
  using ((select public.is_studio_member(studio_id)));
create policy studio_photos_insert on public.studio_photos for insert to authenticated
  with check (
    (select public.is_studio_member(studio_id)) and (select public.studio_has_access(studio_id))
    and split_part(path, '/', 1) = studio_id::text
  );
create policy studio_photos_update on public.studio_photos for update to authenticated
  using ((select public.is_studio_member(studio_id)))
  with check ((select public.is_studio_member(studio_id)) and (select public.studio_has_access(studio_id)));
create policy studio_photos_delete on public.studio_photos for delete to authenticated
  using ((select public.is_studio_member(studio_id)) and (select public.studio_has_access(studio_id)));

-- Bucket público (só existe no Supabase; ignorado no banco de testes).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('studio-photos', 'studio-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;
  end if;
end $$;

-- Página pública passa a devolver as fotos.
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
    ), '[]'::jsonb)
  )
  from public.studios st
  where st.slug = lower(p_slug);
$$;

-- -----------------------------------------------------------------------------
-- Vários serviços no mesmo agendamento. A duração é a soma dos serviços,
-- o valor é a soma dos preços e o nome junta os serviços com " + ".
-- -----------------------------------------------------------------------------
create function public._resolve_public_services(p_studio_id uuid, p_service_ids uuid[])
returns table (first_id uuid, names text, duration integer, price integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_count integer;
begin
  if p_service_ids is null or cardinality(p_service_ids) = 0 or cardinality(p_service_ids) > 5
     or cardinality(p_service_ids) <> (select count(distinct x) from unnest(p_service_ids) x) then
    raise exception 'SERVICE_NOT_FOUND';
  end if;

  select count(*) into v_count from public.services
  where studio_id = p_studio_id and id = any (p_service_ids) and active and is_public;
  if v_count <> cardinality(p_service_ids) then
    raise exception 'SERVICE_NOT_FOUND';
  end if;

  return query
    select (array_agg(sv.id order by sv.sort_order, sv.name))[1],
           string_agg(sv.name, ' + ' order by sv.sort_order, sv.name),
           sum(sv.duration_minutes)::integer,
           sum(sv.price_cents)::integer
    from public.services sv
    where sv.studio_id = p_studio_id and sv.id = any (p_service_ids);
end;
$$;

create function public.get_available_slots_multi(p_slug text, p_service_ids uuid[], p_date date)
returns setof timestamptz
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

  return query
    select * from public._available_slots(v_studio, public._default_professional(v_studio), v_duration, p_date);
end;
$$;

create function public.book_appointment_multi(
  p_slug text, p_service_ids uuid[], p_starts_at timestamptz,
  p_customer_name text, p_customer_phone text, p_customer_note text default null
) returns table (token text, status public.appointment_status)
language plpgsql security definer set search_path = '' as $$
declare
  v_studio public.studios%rowtype;
  v_svc record;
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

  select * into v_svc from public._resolve_public_services(v_studio.id, p_service_ids);

  v_prof := public._default_professional(v_studio.id);
  if v_prof is null then
    raise exception 'SLOT_UNAVAILABLE';
  end if;

  -- Serializa agendamentos do mesmo profissional dentro desta transação.
  perform pg_advisory_xact_lock(hashtextextended(v_prof::text, 0));

  v_local_date := (p_starts_at at time zone v_studio.timezone)::date;
  if not exists (
    select 1 from public._available_slots(v_studio.id, v_prof, v_svc.duration, v_local_date) s
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
      v_studio.id, v_prof, v_svc.first_id, v_customer, p_starts_at,
      p_starts_at + make_interval(mins => v_svc.duration),
      v_status, 'online', v_svc.names, v_svc.price, nullif(trim(p_customer_note), '')
    ) returning public_token into v_token;
  exception when exclusion_violation then
    raise exception 'SLOT_UNAVAILABLE';
  end;

  return query select v_token, v_status;
end;
$$;

revoke execute on function public._resolve_public_services(uuid, uuid[]) from public, anon, authenticated;
revoke execute on function public.get_available_slots_multi(text, uuid[], date) from public;
revoke execute on function public.book_appointment_multi(text, uuid[], timestamptz, text, text, text) from public;
grant execute on function public.get_available_slots_multi(text, uuid[], date) to anon, authenticated;
grant execute on function public.book_appointment_multi(text, uuid[], timestamptz, text, text, text) to anon, authenticated;
