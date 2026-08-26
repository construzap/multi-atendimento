-- Migra vínculos legados de produtos_workspace.termo_pesquisa → produto_termo_de_pesquisa_vinculo.
-- Idempotente: ignora linhas que já possuem vínculo equivalente.

insert into public.produto_termo_de_pesquisa_vinculo (produto_id, termo_id)
select p.id, p.termo_pesquisa
from public.produtos_workspace p
where p.termo_pesquisa is not null
on conflict (produto_id, termo_id) do nothing;
