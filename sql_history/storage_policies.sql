-- Permettre à tout le monde de VOIR les images (bucket public)
create policy "Public read access" on storage.objects for
select
  using (bucket_id = 'recipe-images');

-- Permettre à tout le monde d'UPLOADER des images
create policy "Anyone can upload recipe images" on storage.objects for INSERT
with
  check (bucket_id = 'recipe-images');

-- Permettre à tout le monde de MODIFIER des images
create policy "Anyone can update recipe images" on storage.objects
for update
  using (bucket_id = 'recipe-images');

-- Permettre à tout le monde de SUPPRIMER des images
create policy "Anyone can delete recipe images" on storage.objects for DELETE using (bucket_id = 'recipe-images');