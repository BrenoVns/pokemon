-- Fichário Pokémon — esquema inicial
-- Rode este arquivo inteiro no SQL Editor do Supabase (ou via `supabase db push`).

-- ---------------------------------------------------------------------------
-- Coleções (preparado para várias; a interface usa só a "Coleção principal")
-- ---------------------------------------------------------------------------
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists collections_user_id_idx on public.collections (user_id);

-- ---------------------------------------------------------------------------
-- Cartas
-- ---------------------------------------------------------------------------
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  collection_id uuid not null references public.collections (id) on delete cascade,
  tcgdex_id text,
  name text not null,
  set_id text,
  set_name text,
  card_number text,
  set_total text,
  image_url text,
  photo_path text,
  liga_url text,
  quantity int not null default 1 check (quantity >= 1),
  condition text not null default 'NM' check (condition in ('M', 'NM', 'SP', 'MP', 'HP', 'D')),
  language text not null default 'PT' check (language in ('PT', 'EN', 'JP', 'Outro')),
  variant text not null default 'Normal'
    check (variant in ('Normal', 'Foil', 'Reverse Foil', 'Pokeball Foil', 'Master Ball Foil', 'Outro')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Identifica "a mesma carta": o id do TCGdex ou, no cadastro manual, nome + set + número.
  card_key text generated always as (
    coalesce(tcgdex_id, lower(name) || '|' || coalesce(set_name, '') || '|' || coalesce(card_number, ''))
  ) stored
);

-- Cada combinação carta + condição + idioma + variante é um registro único.
create unique index if not exists cards_combination_key
  on public.cards (collection_id, card_key, condition, language, variant);
create index if not exists cards_user_id_idx on public.cards (user_id);
create index if not exists cards_collection_id_idx on public.cards (collection_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cards_set_updated_at on public.cards;
create trigger cards_set_updated_at
  before update on public.cards
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: cada usuário só enxerga e altera as próprias linhas
-- ---------------------------------------------------------------------------
alter table public.collections enable row level security;
alter table public.cards enable row level security;

grant select, insert, update, delete on public.collections to authenticated;
grant select, insert, update, delete on public.cards to authenticated;

drop policy if exists "collections: dono" on public.collections;
create policy "collections: dono" on public.collections
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "cards: dono" on public.cards;
create policy "cards: dono" on public.cards
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.collections c
      where c.id = collection_id and c.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Storage: bucket privado card-photos, uma pasta por usuário (<user_id>/arquivo.jpg)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-photos', 'card-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "card-photos: ler as próprias" on storage.objects;
create policy "card-photos: ler as próprias" on storage.objects
  for select to authenticated
  using (bucket_id = 'card-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "card-photos: enviar as próprias" on storage.objects;
create policy "card-photos: enviar as próprias" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'card-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "card-photos: atualizar as próprias" on storage.objects;
create policy "card-photos: atualizar as próprias" on storage.objects
  for update to authenticated
  using (bucket_id = 'card-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'card-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "card-photos: apagar as próprias" on storage.objects;
create policy "card-photos: apagar as próprias" on storage.objects
  for delete to authenticated
  using (bucket_id = 'card-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
