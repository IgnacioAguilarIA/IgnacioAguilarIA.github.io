-- Agenda FICH V98 — catálogo de alimentos + alimentos personales + detalle estructurado de comidas
-- Ejecutar una sola vez (o volver a ejecutar de forma segura si se actualiza la migración).
-- Este script NO modifica ninguna tabla ni lógica de entrenamiento.

create extension if not exists pgcrypto;

create or replace function public.normalize_food_search(input text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(
    regexp_replace(
      translate(lower(coalesce(input,'')), 'áéíóúüñ', 'aeiouun'),
      '[^a-z0-9 ]+', ' ', 'g'
    ),
    '\s+', ' ', 'g'
  ));
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.food_catalog (
  id bigint generated always as identity primary key,
  name text not null,
  brand text not null default '',
  category text not null default '',
  aliases text[] not null default '{}',
  serving_size text,
  serving_quantity numeric,
  unit text not null default 'g',
  calories_per_100g numeric not null default 0,
  protein_per_100g numeric not null default 0,
  carbs_per_100g numeric not null default 0,
  fat_per_100g numeric not null default 0,
  fiber_per_100g numeric,
  source text not null default 'curated',
  locale text not null default 'es-AR',
  is_generic boolean not null default true,
  active boolean not null default true,
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  catalog_id bigint references public.food_catalog(id) on delete set null,
  source text not null default 'external',
  external_id text,
  fingerprint text not null,
  name text not null,
  brand text not null default '',
  quantity_label text not null default '',
  serving_size text not null default '',
  serving_quantity numeric,
  unit text not null default 'g',
  calories_per_100g numeric not null default 0,
  protein_per_100g numeric not null default 0,
  carbs_per_100g numeric not null default 0,
  fat_per_100g numeric not null default 0,
  fiber_per_100g numeric,
  ingredients text not null default '',
  categories text not null default '',
  labels text not null default '',
  image_url text not null default '',
  is_generic boolean not null default false,
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_foods_user_fingerprint_uniq unique(user_id, fingerprint)
);

create table if not exists public.nutrition_meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  catalog_id bigint references public.food_catalog(id) on delete set null,
  user_food_id uuid references public.user_foods(id) on delete set null,
  source text not null default 'external',
  external_id text,
  name text not null,
  brand text not null default '',
  quantity numeric not null default 0,
  unit text not null default 'g',
  serving_size text not null default '',
  calories_per_100g numeric not null default 0,
  protein_per_100g numeric not null default 0,
  carbs_per_100g numeric not null default 0,
  fat_per_100g numeric not null default 0,
  fiber_per_100g numeric,
  ingredients text not null default '',
  categories text not null default '',
  labels text not null default '',
  image_url text not null default '',
  created_at timestamptz not null default now()
);

-- Recalcula los textos de búsqueda cada vez que cambian los datos relevantes.
create or replace function public.refresh_food_catalog_search_text()
returns trigger
language plpgsql
as $$
begin
  new.search_text := public.normalize_food_search(
    concat_ws(' ', new.name, new.brand, new.category, array_to_string(new.aliases, ' '))
  );
  return new;
end;
$$;

drop trigger if exists trg_food_catalog_search_text on public.food_catalog;
create trigger trg_food_catalog_search_text
before insert or update of name, brand, category, aliases on public.food_catalog
for each row execute function public.refresh_food_catalog_search_text();

drop trigger if exists trg_food_catalog_updated_at on public.food_catalog;
create trigger trg_food_catalog_updated_at
before update on public.food_catalog
for each row execute function public.touch_updated_at();

create or replace function public.refresh_user_food_search_text()
returns trigger
language plpgsql
as $$
begin
  new.search_text := public.normalize_food_search(
    concat_ws(' ', new.name, new.brand, new.categories, new.labels, new.ingredients)
  );
  return new;
end;
$$;

drop trigger if exists trg_user_foods_search_text on public.user_foods;
create trigger trg_user_foods_search_text
before insert or update of name, brand, categories, labels, ingredients on public.user_foods
for each row execute function public.refresh_user_food_search_text();

drop trigger if exists trg_user_foods_updated_at on public.user_foods;
create trigger trg_user_foods_updated_at
before update on public.user_foods
for each row execute function public.touch_updated_at();

create index if not exists idx_food_catalog_search_text on public.food_catalog using gin (to_tsvector('simple', search_text));
create index if not exists idx_food_catalog_active on public.food_catalog(active);
create index if not exists idx_user_foods_user_search on public.user_foods(user_id, search_text);
create index if not exists idx_user_foods_user_updated on public.user_foods(user_id, updated_at desc);
create index if not exists idx_meal_items_user_meal on public.nutrition_meal_items(user_id, meal_id);

alter table public.food_catalog enable row level security;
alter table public.user_foods enable row level security;
alter table public.nutrition_meal_items enable row level security;

drop policy if exists "food_catalog_authenticated_read" on public.food_catalog;
create policy "food_catalog_authenticated_read"
on public.food_catalog for select
to authenticated
using (active = true);

drop policy if exists "user_foods_own_select" on public.user_foods;
create policy "user_foods_own_select"
on public.user_foods for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_foods_own_insert" on public.user_foods;
create policy "user_foods_own_insert"
on public.user_foods for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_foods_own_update" on public.user_foods;
create policy "user_foods_own_update"
on public.user_foods for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "user_foods_own_delete" on public.user_foods;
create policy "user_foods_own_delete"
on public.user_foods for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "meal_items_own_select" on public.nutrition_meal_items;
create policy "meal_items_own_select"
on public.nutrition_meal_items for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "meal_items_own_insert" on public.nutrition_meal_items;
create policy "meal_items_own_insert"
on public.nutrition_meal_items for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "meal_items_own_update" on public.nutrition_meal_items;
create policy "meal_items_own_update"
on public.nutrition_meal_items for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "meal_items_own_delete" on public.nutrition_meal_items;
create policy "meal_items_own_delete"
on public.nutrition_meal_items for delete
to authenticated
using (auth.uid() = user_id);

-- Catálogo inicial: alimentos genéricos comunes. Valores por 100 g, parte comestible.
-- Es un punto de partida editable; los productos de marca siguen entrando por Open Food Facts.
insert into public.food_catalog
(name, category, aliases, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, source, locale)
select * from (values
 ('Manzana','Frutas',ARRAY['apple','manzana roja','manzana verde'],52,0.3,13.8,0.2,2.4,'curated','es-AR'),
 ('Banana','Frutas',ARRAY['banana','plátano','platano'],89,1.1,22.8,0.3,2.6,'curated','es-AR'),
 ('Pera','Frutas',ARRAY['pear'],57,0.4,15.2,0.1,3.1,'curated','es-AR'),
 ('Naranja','Frutas',ARRAY['orange'],47,0.9,11.8,0.1,2.4,'curated','es-AR'),
 ('Mandarina','Frutas',ARRAY['tangerine','mandarin'],53,0.8,13.3,0.3,1.8,'curated','es-AR'),
 ('Frutilla','Frutas',ARRAY['fresa','strawberry'],32,0.7,7.7,0.3,2.0,'curated','es-AR'),
 ('Uva','Frutas',ARRAY['grape','grapes'],69,0.7,18.1,0.2,0.9,'curated','es-AR'),
 ('Durazno','Frutas',ARRAY['peach'],39,0.9,9.5,0.3,1.5,'curated','es-AR'),
 ('Ciruela','Frutas',ARRAY['plum'],46,0.7,11.4,0.3,1.4,'curated','es-AR'),
 ('Ananá','Frutas',ARRAY['piña','pineapple'],50,0.5,13.1,0.1,1.4,'curated','es-AR'),
 ('Mango','Frutas',ARRAY['mango'],60,0.8,15.0,0.4,1.6,'curated','es-AR'),
 ('Kiwi','Frutas',ARRAY['kiwi'],61,1.1,14.7,0.5,3.0,'curated','es-AR'),
 ('Sandía','Frutas',ARRAY['watermelon'],30,0.6,7.6,0.2,0.4,'curated','es-AR'),
 ('Melón','Frutas',ARRAY['melon'],34,0.8,8.2,0.2,0.9,'curated','es-AR'),
 ('Palta','Frutas',ARRAY['aguacate','avocado'],160,2.0,8.5,14.7,6.7,'curated','es-AR'),
 ('Papa','Verduras y tubérculos',ARRAY['patata','potato'],77,2.0,17.5,0.1,2.2,'curated','es-AR'),
 ('Batata','Verduras y tubérculos',ARRAY['boniato','sweet potato'],86,1.6,20.1,0.1,3.0,'curated','es-AR'),
 ('Zanahoria','Verduras',ARRAY['carrot'],41,0.9,9.6,0.2,2.8,'curated','es-AR'),
 ('Cebolla','Verduras',ARRAY['onion'],40,1.1,9.3,0.1,1.7,'curated','es-AR'),
 ('Tomate','Verduras',ARRAY['tomato'],18,0.9,3.9,0.2,1.2,'curated','es-AR'),
 ('Lechuga','Verduras',ARRAY['lettuce'],15,1.4,2.9,0.2,1.3,'curated','es-AR'),
 ('Espinaca','Verduras',ARRAY['spinach'],23,2.9,3.6,0.4,2.2,'curated','es-AR'),
 ('Brócoli','Verduras',ARRAY['brocoli','broccoli'],34,2.8,7.0,0.4,2.6,'curated','es-AR'),
 ('Coliflor','Verduras',ARRAY['cauliflower'],25,1.9,5.0,0.3,2.0,'curated','es-AR'),
 ('Morrón rojo','Verduras',ARRAY['pimiento rojo','red pepper','bell pepper'],31,1.0,6.0,0.3,2.1,'curated','es-AR'),
 ('Zapallito','Verduras',ARRAY['zucchini','calabacín'],17,1.2,3.1,0.3,1.0,'curated','es-AR'),
 ('Berenjena','Verduras',ARRAY['eggplant'],25,1.0,6.0,0.2,3.0,'curated','es-AR'),
 ('Zapallo','Verduras',ARRAY['calabaza','pumpkin'],26,1.0,6.5,0.1,0.5,'curated','es-AR'),
 ('Pepino','Verduras',ARRAY['cucumber'],15,0.7,3.6,0.1,0.5,'curated','es-AR'),
 ('Remolacha','Verduras',ARRAY['beet','beetroot'],43,1.6,9.6,0.2,2.8,'curated','es-AR'),
 ('Choclo','Verduras',ARRAY['maíz dulce','corn'],86,3.3,18.7,1.4,2.0,'curated','es-AR'),
 ('Arvejas cocidas','Legumbres',ARRAY['peas','green peas'],84,5.4,15.6,0.4,5.7,'curated','es-AR'),
 ('Chauchas','Verduras',ARRAY['ejotes','green beans'],31,1.8,7.0,0.1,3.4,'curated','es-AR'),
 ('Champiñón','Verduras',ARRAY['hongo','mushroom'],22,3.1,3.3,0.3,1.0,'curated','es-AR'),
 ('Ajo','Verduras',ARRAY['garlic'],149,6.4,33.1,0.5,2.1,'curated','es-AR'),
 ('Arroz blanco crudo','Cereales',ARRAY['arroz','white rice','rice raw'],365,7.1,80.0,0.7,1.3,'curated','es-AR'),
 ('Arroz blanco cocido','Cereales',ARRAY['arroz cocido','cooked rice'],130,2.7,28.2,0.3,0.4,'curated','es-AR'),
 ('Arroz integral crudo','Cereales',ARRAY['brown rice','arroz integral'],370,7.9,77.2,2.9,3.5,'curated','es-AR'),
 ('Avena seca','Cereales',ARRAY['avena','oats','rolled oats'],389,16.9,66.3,6.9,10.6,'curated','es-AR'),
 ('Harina de maíz','Cereales',ARRAY['polenta seca','corn flour'],361,6.9,76.9,3.9,7.3,'curated','es-AR'),
 ('Harina de trigo','Cereales',ARRAY['harina común','wheat flour'],364,10.3,76.3,1.0,2.7,'curated','es-AR'),
 ('Harina integral','Cereales',ARRAY['whole wheat flour'],340,13.7,72.6,2.5,10.7,'curated','es-AR'),
 ('Pan blanco','Panificados',ARRAY['white bread','bread'],266,8.9,49.4,3.2,2.7,'curated','es-AR'),
 ('Pan integral','Panificados',ARRAY['whole wheat bread','integral bread'],247,13.0,41.0,4.2,7.0,'curated','es-AR'),
 ('Pasta seca','Cereales',ARRAY['fideos secos','spaghetti dry','pasta'],371,13.0,74.7,1.5,3.2,'curated','es-AR'),
 ('Pasta cocida','Cereales',ARRAY['fideos cocidos','cooked pasta'],158,5.8,30.9,0.9,1.8,'curated','es-AR'),
 ('Quinoa cruda','Cereales',ARRAY['quinoa raw','quinua'],368,14.1,64.2,6.1,7.0,'curated','es-AR'),
 ('Quinoa cocida','Cereales',ARRAY['quinoa cooked'],120,4.4,21.3,1.9,2.8,'curated','es-AR'),
 ('Polenta cocida','Cereales',ARRAY['cornmeal cooked','polenta'],70,1.7,15.2,0.3,0.8,'curated','es-AR'),
 ('Fécula de mandioca','Cereales',ARRAY['tapioca','tapioca starch'],358,0.2,88.7,0.0,0.9,'curated','es-AR'),
 ('Lentejas secas','Legumbres',ARRAY['lentils dry'],352,24.6,63.4,1.1,10.7,'curated','es-AR'),
 ('Lentejas cocidas','Legumbres',ARRAY['lentils cooked'],116,9.0,20.1,0.4,7.9,'curated','es-AR'),
 ('Garbanzos secos','Legumbres',ARRAY['chickpeas dry','garbanzo'],378,20.5,63.0,6.0,12.2,'curated','es-AR'),
 ('Garbanzos cocidos','Legumbres',ARRAY['chickpeas cooked'],164,8.9,27.4,2.6,7.6,'curated','es-AR'),
 ('Porotos negros cocidos','Legumbres',ARRAY['black beans'],132,8.9,23.7,0.5,8.7,'curated','es-AR'),
 ('Porotos colorados cocidos','Legumbres',ARRAY['kidney beans'],127,8.7,22.8,0.5,6.4,'curated','es-AR'),
 ('Soja cocida','Legumbres',ARRAY['soybeans'],173,16.6,9.9,9.0,6.0,'curated','es-AR'),
 ('Huevo entero crudo','Proteínas',ARRAY['huevo','egg','whole egg'],143,12.6,0.7,9.5,0.0,'curated','es-AR'),
 ('Clara de huevo','Proteínas',ARRAY['egg white','claras'],52,10.9,0.7,0.2,0.0,'curated','es-AR'),
 ('Pechuga de pollo cruda','Carnes',ARRAY['pollo','chicken breast raw'],120,22.5,0.0,2.6,0.0,'curated','es-AR'),
 ('Pechuga de pollo cocida','Carnes',ARRAY['chicken breast cooked'],165,31.0,0.0,3.6,0.0,'curated','es-AR'),
 ('Carne vacuna magra cruda','Carnes',ARRAY['carne de vaca','beef lean','beef'],135,21.0,0.0,5.0,0.0,'curated','es-AR'),
 ('Carne vacuna magra cocida','Carnes',ARRAY['beef lean cooked'],217,26.1,0.0,11.8,0.0,'curated','es-AR'),
 ('Carne picada magra','Carnes',ARRAY['ground beef lean','carne molida'],215,26.0,0.0,12.0,0.0,'curated','es-AR'),
 ('Pechuga de pavo cocida','Carnes',ARRAY['turkey breast'],135,29.0,0.0,1.8,0.0,'curated','es-AR'),
 ('Atún al natural escurrido','Pescados',ARRAY['atún en agua','tuna canned water','tuna'],116,26.0,0.0,0.8,0.0,'curated','es-AR'),
 ('Salmón crudo','Pescados',ARRAY['salmon'],208,20.4,0.0,13.4,0.0,'curated','es-AR'),
 ('Merluza cruda','Pescados',ARRAY['hake','merluza'],90,18.0,0.0,1.5,0.0,'curated','es-AR'),
 ('Sardina enlatada','Pescados',ARRAY['sardines'],208,24.6,0.0,11.5,0.0,'curated','es-AR'),
 ('Hígado vacuno crudo','Carnes',ARRAY['beef liver','liver'],135,20.4,3.9,3.6,0.0,'curated','es-AR'),
 ('Leche entera','Lácteos',ARRAY['whole milk','milk'],61,3.2,4.8,3.3,0.0,'curated','es-AR'),
 ('Leche descremada','Lácteos',ARRAY['skim milk','low fat milk'],34,3.4,5.0,0.1,0.0,'curated','es-AR'),
 ('Yogur natural','Lácteos',ARRAY['natural yogurt','plain yogurt'],61,3.5,4.7,3.3,0.0,'curated','es-AR'),
 ('Yogur griego natural','Lácteos',ARRAY['greek yogurt','greek yoghurt'],97,9.0,3.9,5.0,0.0,'curated','es-AR'),
 ('Mozzarella','Lácteos',ARRAY['queso mozzarella'],280,28.0,3.1,17.0,0.0,'curated','es-AR'),
 ('Queso crema','Lácteos',ARRAY['cream cheese'],342,5.9,4.1,34.4,0.0,'curated','es-AR'),
 ('Queso parmesano','Lácteos',ARRAY['parmesan'],431,38.5,4.1,29.0,0.0,'curated','es-AR'),
 ('Manteca','Lácteos',ARRAY['butter'],717,0.9,0.1,81.1,0.0,'curated','es-AR'),
 ('Maní','Frutos secos',ARRAY['cacahuate','peanut','groundnut'],567,25.8,16.1,49.2,8.5,'curated','es-AR'),
 ('Almendra','Frutos secos',ARRAY['almonds'],579,21.2,21.6,49.9,12.5,'curated','es-AR'),
 ('Nuez','Frutos secos',ARRAY['walnut','nuez de castilla'],654,15.2,13.7,65.2,6.7,'curated','es-AR'),
 ('Pecan','Frutos secos',ARRAY['pecana','pecan nut'],691,9.2,13.9,72.0,9.6,'curated','es-AR'),
 ('Castaña de cajú','Frutos secos',ARRAY['cashew','castaña de cajú'],553,18.2,30.2,43.8,3.3,'curated','es-AR'),
 ('Pistacho','Frutos secos',ARRAY['pistachio'],562,20.2,27.2,45.3,10.3,'curated','es-AR'),
 ('Semillas de chía','Semillas',ARRAY['chia seeds','chia'],486,16.5,42.1,30.7,34.4,'curated','es-AR'),
 ('Semillas de lino','Semillas',ARRAY['flaxseed','linseed'],534,18.3,28.9,42.2,27.3,'curated','es-AR'),
 ('Semillas de girasol','Semillas',ARRAY['sunflower seeds'],584,20.8,20.0,51.5,8.6,'curated','es-AR'),
 ('Semillas de sésamo','Semillas',ARRAY['sesame seeds','sesame'],573,17.7,23.5,49.7,11.8,'curated','es-AR'),
 ('Mantequilla de maní','Untables',ARRAY['mantequilla de cacahuate','peanut butter'],588,25.1,20.0,50.0,6.0,'curated','es-AR')
) as seed(name,category,aliases,calories_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,fiber_per_100g,source,locale)
where not exists (
  select 1 from public.food_catalog f where lower(f.name)=lower(seed.name) and lower(f.brand)=lower('')
);

-- Refresca registros antiguos por si una migración previa los creó sin search_text.
update public.food_catalog
set search_text=public.normalize_food_search(concat_ws(' ',name,brand,category,array_to_string(aliases,' ')))
where search_text='';

update public.user_foods
set search_text=public.normalize_food_search(concat_ws(' ',name,brand,categories,labels,ingredients))
where search_text='';
