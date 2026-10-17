-- Nome digitado em cada agendamento. A cliente continua sendo identificada pelo
-- telefone (mesma ficha), mas a agenda mostra o nome usado naquele agendamento
-- (ex.: mãe agendando para a filha pelo mesmo celular).

alter table public.appointments
  add column customer_name text check (char_length(customer_name) between 2 and 80);

-- Todas as funções que criam agendamento chamam _upsert_customer antes do
-- insert; ela guarda o nome digitado só até o fim da transação, e o gatilho
-- abaixo copia esse nome para o agendamento.
create or replace function public._upsert_customer(p_studio_id uuid, p_name text, p_phone text, p_at timestamptz)
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
  perform set_config('bellink.customer_name', trim(p_name), true);
  return v_id;
end;
$$;

create function public._appointment_customer_name() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.customer_name is null then
    new.customer_name := nullif(current_setting('bellink.customer_name', true), '');
  end if;
  return new;
end;
$$;

create trigger appointments_customer_name before insert on public.appointments
  for each row execute function public._appointment_customer_name();

create or replace function public.get_public_appointment(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'status', a.status,
    'starts_at', a.starts_at,
    'ends_at', a.ends_at,
    'service_name', a.service_name,
    'price_cents', a.price_cents,
    'professional_name', pr.name,
    'customer_first_name', split_part(coalesce(a.customer_name, c.name), ' ', 1),
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

-- Se o studio corrigir o nome na ficha, os agendamentos que usavam o nome
-- antigo acompanham a correção.
create function public._customer_name_follow() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.name is distinct from old.name then
    update public.appointments
       set customer_name = new.name
     where customer_id = new.id and customer_name = old.name;
  end if;
  return new;
end;
$$;

create trigger customers_name_follow after update of name on public.customers
  for each row execute function public._customer_name_follow();

revoke execute on function public._appointment_customer_name() from public, anon, authenticated;
revoke execute on function public._customer_name_follow() from public, anon, authenticated;
