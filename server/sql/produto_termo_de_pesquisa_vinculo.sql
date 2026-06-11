-- Vínculo N:N entre produtos e termos de pesquisa do workspace.
-- A tabela `produto_termo_de_pesquisa` já deve existir (catálogo por workspace).

create table if not exists public.produto_termo_de_pesquisa_vinculo (
  produto_id bigint not null,
  termo_id bigint not null,
  created_at timestamp with time zone not null default now(),
  constraint produto_termo_de_pesquisa_vinculo_pkey primary key (produto_id, termo_id),
  constraint produto_termo_de_pesquisa_vinculo_produto_id_fkey
    foreign key (produto_id) references public.produtos_workspace (id) on delete cascade,
  constraint produto_termo_de_pesquisa_vinculo_termo_id_fkey
    foreign key (termo_id) references public.produto_termo_de_pesquisa (id) on delete cascade
);

create index if not exists produto_termo_de_pesquisa_vinculo_produto_id_idx
  on public.produto_termo_de_pesquisa_vinculo (produto_id);

create index if not exists produto_termo_de_pesquisa_vinculo_termo_id_idx
  on public.produto_termo_de_pesquisa_vinculo (termo_id);

-- Nome único por workspace (comparação case-insensitive).
create unique index if not exists produto_termo_de_pesquisa_workspace_nome_unique
  on public.produto_termo_de_pesquisa (workspace_id, lower(trim(nome)));

-- Depois rode: server/sql/view_produtos_com_variacoes_termos_pesquisa.sql
