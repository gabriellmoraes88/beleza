-- Identidade Bellink: nova cor padrão (nude rosado) para a página pública dos studios.
alter table public.studios alter column primary_color set default '#9a5b60';

-- Studios que ainda usam a cor padrão antiga passam para a nova.
update public.studios set primary_color = '#9a5b60' where primary_color = '#db2777';
