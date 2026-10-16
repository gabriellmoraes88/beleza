-- Cor padrão neutra (grafite) para as páginas públicas dos studios.
alter table public.studios alter column primary_color set default '#292524';
update public.studios set primary_color = '#292524' where primary_color in ('#db2777', '#9a5b60');
