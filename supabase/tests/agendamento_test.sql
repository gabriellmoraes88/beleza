-- Testes de integração do schema (rodar num banco com stub_supabase.sql + migrações).
-- Uso: veja supabase/tests/README.md
\set ON_ERROR_STOP 1

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'bia@example.com');

-- Ana cria o studio dela
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public.create_studio('Espaço da Ana', 'espaco-da-ana', 'Ana', '5511999990000') as ana_studio \gset
insert into public.services (studio_id, name, duration_minutes, price_cents)
values (:'ana_studio', 'Manicure tradicional', 45, 3500) returning id as svc \gset
insert into public.services (studio_id, name, duration_minutes, price_cents)
values (:'ana_studio', 'Pedicure', 30, 2000) returning id as svc2 \gset

-- Abre todos os dias 09-12 / 13-19 para o teste não depender do dia da semana
select public.set_working_hours(
  (select id from public.professionals where studio_id = :'ana_studio'),
  (select jsonb_agg(x) from (
     select jsonb_build_object('weekday', d, 'start', '09:00', 'end', '12:00') x from generate_series(0,6) d
     union all
     select jsonb_build_object('weekday', d, 'start', '13:00', 'end', '19:00') from generate_series(0,6) d) q));

do $$ begin
  begin
    perform public.create_studio('Outro', 'outro-studio', 'Ana', '5511999990000');
    raise exception 'esperava ALREADY_HAS_STUDIO';
  exception when others then
    if sqlerrm <> 'ALREADY_HAS_STUDIO' then raise; end if;
  end;
end $$;

-- Bia cria outro studio e não enxerga nada da Ana
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  begin
    perform public.create_studio('Studio Bia', 'espaco-da-ana', 'Bia', '5511988880000');
    raise exception 'esperava SLUG_TAKEN';
  exception when others then
    if sqlerrm <> 'SLUG_TAKEN' then raise; end if;
  end;
end $$;
select public.create_studio('Studio Bia', 'studio-bia', 'Bia', '5511988880000') as bia_studio \gset
do $$ begin
  if (select count(*) from public.studios) <> 1 then raise exception 'RLS: Bia vê studios de outros'; end if;
  if (select count(*) from public.services) <> 0 then raise exception 'RLS: Bia vê serviços de outros'; end if;
end $$;
update public.services set price_cents = 1 where studio_id = :'ana_studio';
do $$ begin
  begin
    insert into public.services (studio_id, name, duration_minutes) values
      ((select id from public.studios where slug = 'espaco-da-ana' union select '00000000-0000-0000-0000-000000000000'::uuid limit 1), 'Hack', 30);
    raise exception 'RLS: Bia inseriu serviço em outro studio';
  exception when insufficient_privilege then null;
  end;
end $$;
-- Bia não consegue mexer na própria assinatura pelo navegador
do $$ begin
  begin
    update public.subscriptions set status = 'active';
    raise exception 'authenticated conseguiu alterar assinatura';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.studios set suspended_at = null;
    raise exception 'authenticated conseguiu alterar coluna protegida';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Fotos: Bia não grava foto no studio da Ana nem na pasta de outro studio
select set_config('t.ana', :'ana_studio', false), set_config('t.bia', :'bia_studio', false);
do $$ begin
  begin
    insert into public.studio_photos (studio_id, path)
    values (current_setting('t.ana')::uuid, current_setting('t.ana') || '/00000000-0000-0000-0000-000000000001.jpg');
    raise exception 'RLS: Bia gravou foto em outro studio';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.studio_photos (studio_id, path)
    values (current_setting('t.bia')::uuid, current_setting('t.ana') || '/00000000-0000-0000-0000-000000000002.jpg');
    raise exception 'RLS: Bia gravou foto na pasta de outro studio';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into public.studio_photos (studio_id, path)
values (:'ana_studio', :'ana_studio' || '/00000000-0000-0000-0000-000000000003.jpg');

-- Cliente anônimo
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
do $$ begin
  begin
    perform 1 from public.appointments;
    raise exception 'anon leu appointments';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.customers;
    raise exception 'anon leu customers';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.customer_stats;
    raise exception 'anon leu customer_stats';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public._available_slots(null, null, 30, current_date);
    raise exception 'anon executou função interna';
  exception when insufficient_privilege then null;
  end;
end $$;
select public.get_public_studio('espaco-da-ana') ->> 'name' as nome_publico;
select (public.get_public_studio('espaco-da-ana') -> 'services' -> 0 ->> 'price_cents')::int = 3500 as preco_intacto;

-- Data de teste: amanhã no fuso do studio
select ((now() at time zone 'America/Sao_Paulo')::date + 1) as dia \gset
select count(*) as slots_antes from public.get_available_slots('espaco-da-ana', :'svc', :'dia') \gset
select s as slot1 from public.get_available_slots('espaco-da-ana', :'svc', :'dia') s limit 1 \gset
\echo slots antes: :slots_antes primeiro: :slot1

select token as tok from public.book_appointment('espaco-da-ana', :'svc', :'slot1', 'Maria Souza', '5511977776666', 'oi') \gset

-- Mesmo horário de novo: deve falhar
select set_config('t.slot', :'slot1', false), set_config('t.svc', :'svc', false);
do $$ begin
  begin
    perform public.book_appointment('espaco-da-ana', current_setting('t.svc')::uuid,
      current_setting('t.slot')::timestamptz, 'João', '5511966665555');
    raise exception 'horário duplicado aceito';
  exception when others then
    if sqlerrm <> 'SLOT_UNAVAILABLE' then raise; end if;
  end;
  -- Horário parcialmente sobreposto (15 min depois) também deve falhar
  begin
    perform public.book_appointment('espaco-da-ana', current_setting('t.svc')::uuid,
      current_setting('t.slot')::timestamptz + interval '15 minutes', 'João', '5511966665555');
    raise exception 'horário sobreposto aceito';
  exception when others then
    if sqlerrm <> 'SLOT_UNAVAILABLE' then raise; end if;
  end;
end $$;
do $$ begin
  begin
    perform public.book_appointment('espaco-da-ana', '00000000-0000-0000-0000-000000000000', now(), 'João', '5511966665555');
    raise exception 'serviço inexistente aceito';
  exception when others then
    if sqlerrm <> 'SERVICE_NOT_FOUND' then raise; end if;
  end;
end $$;
select count(*) as slots_depois from public.get_available_slots('espaco-da-ana', :'svc', :'dia') \gset
\echo slots depois: :slots_depois
select (public.get_public_appointment(:'tok') ->> 'status') as status_publico;
select public.cancel_public_appointment(:'tok') as cancelou;
select count(*) = :slots_antes as slots_voltaram from public.get_available_slots('espaco-da-ana', :'svc', :'dia');

-- Fotos aparecem na página pública e anon não lê a tabela
select jsonb_array_length(public.get_public_studio('espaco-da-ana') -> 'photos') = 1 as fotos_publicas;
do $$ begin
  begin
    perform 1 from public.studio_photos;
    raise exception 'anon leu studio_photos';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Vários serviços: duração e valor somados, sem sobreposição
select s as slot_multi from public.get_available_slots_multi('espaco-da-ana', array[:'svc', :'svc2']::uuid[], :'dia') s limit 1 \gset
select token as tok_multi from public.book_appointment_multi('espaco-da-ana', array[:'svc', :'svc2']::uuid[], :'slot_multi', 'Rita Lima', '5511933332222') \gset
select public.get_public_appointment(:'tok_multi') as ag_multi \gset
select set_config('t.ag', :'ag_multi', false);
do $$
declare a jsonb := current_setting('t.ag')::jsonb;
begin
  if (a ->> 'ends_at')::timestamptz - (a ->> 'starts_at')::timestamptz <> interval '75 minutes' then
    raise exception 'duração somada errada: %', a;
  end if;
  if (a ->> 'price_cents')::int <> 5500 or a ->> 'service_name' <> 'Manicure tradicional + Pedicure' then
    raise exception 'valor/nome somados errados: %', a;
  end if;
end $$;

-- Mesmo telefone com outro nome: mesma ficha, mas o agendamento guarda o nome digitado
select s as slot_nome from public.get_available_slots_multi('espaco-da-ana', array[:'svc']::uuid[], (:'dia'::date + 2)) s limit 1 \gset
select token as tok_nome from public.book_appointment_multi('espaco-da-ana', array[:'svc']::uuid[], :'slot_nome', 'Bia Lima', '5511933332222') \gset
reset role;
select set_config('t.tok_nome', :'tok_nome', false);
select set_config('t.tok_multi', :'tok_multi', false);
do $$
declare
  a public.appointments;
  b public.appointments;
begin
  select * into a from public.appointments where public_token = current_setting('t.tok_multi');
  select * into b from public.appointments where public_token = current_setting('t.tok_nome');
  if b.customer_id <> a.customer_id then raise exception 'mesmo telefone virou outra ficha'; end if;
  if a.customer_name <> 'Rita Lima' or b.customer_name <> 'Bia Lima' then
    raise exception 'nome por agendamento errado: % / %', a.customer_name, b.customer_name;
  end if;
  if (select name from public.customers where id = a.customer_id) <> 'Rita Lima' then
    raise exception 'ficha perdeu o primeiro nome';
  end if;
  if public.get_public_appointment(current_setting('t.tok_nome')) ->> 'customer_first_name' <> 'Bia' then
    raise exception 'comprovante com nome errado';
  end if;
  update public.customers set name = 'Rita Souza Lima' where id = a.customer_id;
  if (select customer_name from public.appointments where id = a.id) <> 'Rita Souza Lima'
     or (select customer_name from public.appointments where id = b.id) <> 'Bia Lima' then
    raise exception 'correção do nome na ficha não acompanhou só os agendamentos dela';
  end if;
end $$;
set role anon;
select set_config('t.slot_multi', :'slot_multi', false), set_config('t.svc2', :'svc2', false);
do $$ begin
  -- 60 min depois do início ainda está dentro dos 75 min: deve falhar
  begin
    perform public.book_appointment('espaco-da-ana', current_setting('t.svc2')::uuid,
      current_setting('t.slot_multi')::timestamptz + interval '60 minutes', 'João', '5511966665555');
    raise exception 'sobreposição com agendamento de vários serviços aceita';
  exception when others then
    if sqlerrm <> 'SLOT_UNAVAILABLE' then raise; end if;
  end;
  begin
    perform public.book_appointment_multi('espaco-da-ana', array[current_setting('t.svc2')::uuid, current_setting('t.svc2')::uuid],
      current_setting('t.slot_multi')::timestamptz + interval '3 hours', 'João', '5511966665555');
    raise exception 'serviço repetido aceito';
  exception when others then
    if sqlerrm <> 'SERVICE_NOT_FOUND' then raise; end if;
  end;
end $$;
select public.cancel_public_appointment(:'tok_multi') as cancelou_multi;

-- Painel: bloqueio remove horários e manual não sobrepõe
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into public.time_blocks (studio_id, starts_at, ends_at, reason)
values (:'ana_studio', (:'dia'::date + time '09:00') at time zone 'America/Sao_Paulo',
        (:'dia'::date + time '12:00') at time zone 'America/Sao_Paulo', 'Médico');
select count(*) < :slots_antes as bloqueio_ok from public.studio_available_slots(:'ana_studio', 45, :'dia');
select public.create_manual_appointment(:'ana_studio', :'svc', (:'dia'::date + time '14:00') at time zone 'America/Sao_Paulo', 'Carla', '5511955554444') is not null as manual_ok;
do $$ begin
  begin
    perform public.create_manual_appointment((select id from public.studios limit 1),
      (select id from public.services limit 1),
      (((now() at time zone 'America/Sao_Paulo')::date + 1) + time '14:30') at time zone 'America/Sao_Paulo', 'Dani', '5511944443333');
    raise exception 'sobreposição aceita';
  exception when others then
    if sqlerrm <> 'SLOT_UNAVAILABLE' then raise; end if;
  end;
end $$;
select count(*) as clientes, sum(total_appointments) as total from public.customer_stats;

-- Equipe: segunda profissional, escolha de profissional e "qualquer um"
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  begin
    perform public.add_professional(current_setting('t.ana')::uuid, 'Intrusa');
    raise exception 'Bia adicionou profissional no studio da Ana';
  exception when others then
    if sqlerrm <> 'FORBIDDEN' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public.add_professional(:'ana_studio', 'Júlia') as prof2 \gset
select (select count(*) from public.working_hours where professional_id = :'prof2')
     = (select count(*) from public.working_hours wh join public.professionals p on p.id = wh.professional_id
        where p.studio_id = :'ana_studio' and p.id <> :'prof2') as horario_copiado;
select id as prof1 from public.professionals where studio_id = :'ana_studio' and id <> :'prof2' \gset
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select jsonb_array_length(public.get_public_studio('espaco-da-ana') -> 'professionals') = 2 as equipe_publica;
select ((now() at time zone 'America/Sao_Paulo')::date + 2) as dia2 \gset
select s as slot_eq from public.get_available_slots_multi('espaco-da-ana', array[:'svc']::uuid[], :'dia2') s limit 1 \gset
-- Duas clientes no mesmo horário com "qualquer um": cada uma fica com uma profissional
select token as tok_eq1 from public.book_appointment_multi('espaco-da-ana', array[:'svc']::uuid[], :'slot_eq', 'Lia', '5511911110001') \gset
select token as tok_eq2 from public.book_appointment_multi('espaco-da-ana', array[:'svc']::uuid[], :'slot_eq', 'Rui', '5511911110002') \gset
select (public.get_public_appointment(:'tok_eq1') ->> 'professional_name')
    <> (public.get_public_appointment(:'tok_eq2') ->> 'professional_name') as qualquer_um_divide;
select count(*) = 0 as horario_sumiu
from public.get_available_slots_multi('espaco-da-ana', array[:'svc']::uuid[], :'dia2') s where s = :'slot_eq';
select set_config('t.slot_eq', :'slot_eq', false), set_config('t.prof2', :'prof2', false);
do $$ begin
  begin
    perform public.book_appointment_multi('espaco-da-ana', array[current_setting('t.svc')::uuid],
      current_setting('t.slot_eq')::timestamptz, 'Sol', '5511911110003');
    raise exception 'terceira cliente aceita com a equipe toda ocupada';
  exception when others then
    if sqlerrm <> 'SLOT_UNAVAILABLE' then raise; end if;
  end;
  begin
    perform public.book_appointment_multi('espaco-da-ana', array[current_setting('t.svc')::uuid],
      current_setting('t.slot_eq')::timestamptz + interval '3 hours', 'Sol', '5511911110003', null,
      '00000000-0000-0000-0000-0000000000ff');
    raise exception 'profissional de fora aceito';
  exception when others then
    if sqlerrm <> 'SLOT_UNAVAILABLE' then raise; end if;
  end;
end $$;
-- Escolhendo a profissional, o agendamento fica com ela
select token as tok_eq3 from public.book_appointment_multi('espaco-da-ana', array[:'svc']::uuid[],
  (:'slot_eq'::timestamptz + interval '4 hours'), 'Sol', '5511911110003', null, :'prof2') \gset
select public.get_public_appointment(:'tok_eq3') ->> 'professional_name' = 'Júlia' as escolha_respeitada;
-- Horários da Júlia não mostram o que só a outra profissional tem livre e vice-versa
select count(*) = 0 as filtro_profissional
from public.get_available_slots_multi('espaco-da-ana', array[:'svc']::uuid[], :'dia2', :'prof2') s
where s = :'slot_eq'::timestamptz + interval '4 hours';
select public.cancel_public_appointment(:'tok_eq1') and public.cancel_public_appointment(:'tok_eq2')
   and public.cancel_public_appointment(:'tok_eq3') as cancelou_equipe;
-- Profissional desativada some da página pública
reset role;
update public.professionals set active = false where id = :'prof2';
set role anon;
select jsonb_array_length(public.get_public_studio('espaco-da-ana') -> 'professionals') = 1 as inativa_some;
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

-- Serviços por profissional: Júlia só faz Pedicure
reset role;
update public.professionals set active = true where id = :'prof2';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  begin
    perform public.set_professional_services(current_setting('t.prof2')::uuid, array[current_setting('t.svc2')::uuid]);
    raise exception 'Bia alterou serviços da equipe da Ana';
  exception when others then
    if sqlerrm <> 'FORBIDDEN' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public.set_professional_services(:'prof2', array[:'svc2']::uuid[]);
select count(*) = 1 as servico_gravado from public.professional_services where professional_id = :'prof2';
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select jsonb_array_length((select p -> 'service_ids' from jsonb_array_elements(public.get_public_studio('espaco-da-ana') -> 'professionals') p
        where p ->> 'id' = :'prof2')) = 1 as servicos_publicos;
select count(*) = 0 as julia_sem_manicure
from public.get_available_slots_multi('espaco-da-ana', array[:'svc']::uuid[], :'dia2', :'prof2');
select count(*) > 0 as julia_com_pedicure
from public.get_available_slots_multi('espaco-da-ana', array[:'svc2']::uuid[], :'dia2', :'prof2');
select count(*) = 0 as julia_sem_combo
from public.get_available_slots_multi('espaco-da-ana', array[:'svc', :'svc2']::uuid[], :'dia2', :'prof2');
do $$ begin
  begin
    perform public.book_appointment_multi('espaco-da-ana', array[current_setting('t.svc')::uuid],
      current_setting('t.slot_eq')::timestamptz, 'Bel', '5511911110004', null, current_setting('t.prof2')::uuid);
    raise exception 'Júlia recebeu serviço que não faz';
  exception when others then
    if sqlerrm <> 'SLOT_UNAVAILABLE' then raise; end if;
  end;
end $$;
-- "Qualquer um" para Manicure só pode cair com a outra profissional
select token as tok_sv from public.book_appointment_multi('espaco-da-ana', array[:'svc']::uuid[], :'slot_eq', 'Bel', '5511911110004') \gset
select public.get_public_appointment(:'tok_sv') ->> 'professional_name' <> 'Júlia' as qualquer_respeita_servico;
select public.cancel_public_appointment(:'tok_sv') as cancelou_sv;
-- Marcar todos os serviços volta a "faz todos"
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public.set_professional_services(:'prof2',
  (select array_agg(id) from public.services where studio_id = :'ana_studio' and active));
select count(*) = 0 as todos_vira_padrao from public.professional_services where professional_id = :'prof2';
reset role;

-- Alterar horário: mesmo link, mesma profissional, horário antigo liberado
set role anon;
select s as slot_alt from public.get_available_slots_multi('espaco-da-ana', array[:'svc']::uuid[], :'dia2', :'prof2') s order by s limit 1 \gset
select token as tok_alt from public.book_appointment_multi('espaco-da-ana', array[:'svc']::uuid[], :'slot_alt', 'Gil', '5511911110005', null, :'prof2') \gset
-- O próprio horário aparece de novo na lista (o agendamento sendo alterado não conta como ocupado)
select count(*) = 1 as alt_ve_proprio_horario from public.get_reschedule_slots(:'tok_alt', :'dia2') s where s = :'slot_alt';
select s as slot_novo from public.get_reschedule_slots(:'tok_alt', :'dia2') s where s >= :'slot_alt'::timestamptz + interval '2 hours' order by s limit 1 \gset
select public.reschedule_public_appointment(:'tok_alt', :'slot_novo') is not null as alterou;
select (public.get_public_appointment(:'tok_alt') ->> 'starts_at')::timestamptz = :'slot_novo'::timestamptz as alt_mesmo_link;
select public.get_public_appointment(:'tok_alt') ->> 'professional_name' = 'Júlia' as alt_mesma_profissional;
select count(*) = 1 as alt_libera_antigo from public.get_available_slots_multi('espaco-da-ana', array[:'svc']::uuid[], :'dia2', :'prof2') s where s = :'slot_alt';
-- Horário de outra cliente: recusado
select token as tok_outro from public.book_appointment_multi('espaco-da-ana', array[:'svc']::uuid[], :'slot_alt', 'Lia', '5511911110006', null, :'prof2') \gset
select set_config('t.tok_alt', :'tok_alt', false), set_config('t.slot_alt', :'slot_alt', false);
do $$ begin
  begin
    perform public.reschedule_public_appointment(current_setting('t.tok_alt'), current_setting('t.slot_alt')::timestamptz);
    raise exception 'alterou para horário ocupado';
  exception when others then
    if sqlerrm <> 'SLOT_UNAVAILABLE' then raise; end if;
  end;
end $$;
-- Cancelado não altera
select public.cancel_public_appointment(:'tok_alt') as cancelou_alt;
do $$ begin
  begin
    perform public.reschedule_public_appointment(current_setting('t.tok_alt'), current_setting('t.slot_alt')::timestamptz + interval '3 hours');
    raise exception 'alterou agendamento cancelado';
  exception when others then
    if sqlerrm <> 'CANNOT_CHANGE' then raise; end if;
  end;
end $$;
select count(*) = 0 as cancelado_sem_horarios from public.get_reschedule_slots(:'tok_alt', :'dia2');
select public.cancel_public_appointment(:'tok_outro') as cancelou_outro;
reset role;

-- Assinatura expirada bloqueia escrita e agendamento público, sem apagar dados
reset role;
update public.subscriptions set trial_ends_at = now() - interval '1 day' where studio_id = :'ana_studio';
set role authenticated;
do $$ begin
  begin
    insert into public.services (studio_id, name, duration_minutes) values ((select id from public.studios limit 1), 'Novo', 30);
    raise exception 'escrita aceita com teste expirado';
  exception when insufficient_privilege then null;
  end;
end $$;
select count(*) > 0 as dados_preservados from public.appointments;
reset role;
set role anon;
select (public.get_public_studio('espaco-da-ana') ->> 'accepting_bookings')::boolean = false as pagina_bloqueada;
select count(*) = 0 as sem_slots from public.get_available_slots('espaco-da-ana', :'svc', :'dia');
reset role;
-- Avisos no celular: o navegador não lê os aparelhos cadastrados nem as chaves
reset role;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    execute format('set local role %I', r);
    begin
      perform 1 from public.push_subscriptions;
      raise exception '% leu push_subscriptions', r;
    exception when insufficient_privilege then null;
    end;
    begin
      perform 1 from public.app_secrets;
      raise exception '% leu app_secrets', r;
    exception when insufficient_privilege then null;
    end;
    reset role;
  end loop;
end $$;
-- Recuperar senha por CPF/CNPJ: só o servidor (service_role) lê os hashes e acha a conta pelo e-mail
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    execute format('set local role %I', r);
    begin
      perform 1 from public.account_documents;
      raise exception '% leu account_documents', r;
    exception when insufficient_privilege then null;
    end;
    begin
      perform public.user_id_by_email('x@x.com');
      raise exception '% chamou user_id_by_email', r;
    exception when insufficient_privilege then null;
    end;
    reset role;
  end loop;
end $$;
\echo TODOS OS TESTES PASSARAM
