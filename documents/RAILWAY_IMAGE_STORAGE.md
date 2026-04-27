# Railway Image Storage Without Buckets

This guide documents a **no-bucket** architecture for your digital album: images are stored directly in Railway Postgres.

## Architecture (no object storage)

- Frontend uploads image file to backend via `multipart/form-data`.
- Backend writes binary data to Postgres `bytea`.
- Frontend renders images from backend endpoints like `/api/images/:id/content`.

No S3, R2, or any bucket service is used.

## 1) Provision Railway services

1. Create a Railway project.
2. Add a **PostgreSQL** service.
3. Deploy your backend service (Node/Express/Fastify).
4. Configure backend with `DATABASE_URL`.

## 2) Environment variables

```env
DATABASE_URL=postgresql://...
PORT=3000
MAX_UPLOAD_MB=10
```

## 3) Database schema (binary in Postgres)

```sql
create extension if not exists pgcrypto;

create table if not exists album_images (
  id uuid primary key default gen_random_uuid(),
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  width int,
  height int,
  image_data bytea not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_album_images_created_at
  on album_images(created_at desc);
```

## 4) API design

- `POST /api/images`  
  Accepts one file, validates type and size, inserts row with `image_data`.
- `GET /api/images`  
  Returns metadata only (id, name, dimensions, date).
- `GET /api/images/:id/content`  
  Streams binary image bytes with the row's `mime_type`.
- `DELETE /api/images/:id`  
  Removes row and image bytes.

## 5) Backend logic (no bucket flow)

1. Receive file in memory (`multer.memoryStorage()`).
2. Validate:
   - MIME starts with `image/`
   - file size within limit
3. Optionally compress/resize (recommended for large images).
4. Insert:

```sql
insert into album_images (
  original_name, mime_type, size_bytes, width, height, image_data
) values ($1, $2, $3, $4, $5, $6)
returning id, original_name, mime_type, size_bytes, width, height, created_at;
```

5. Return metadata JSON to frontend.

## 6) Frontend integration logic

Replace local IndexedDB persistence with server persistence:

- Upload: `POST /api/images` with `FormData`.
- Initial load: `GET /api/images`.
- Render each image using:
  - `src = /api/images/{id}/content`
- Delete image: `DELETE /api/images/{id}`.

For smoother UX, you can still show a temporary local preview while upload is in progress.

## 7) Practical limits and tuning

Because bytes are in Postgres:

- Enforce per-file limits (for example 5-10 MB).
- Compress and resize before insert (`sharp` recommended).
- Paginate metadata list (`limit` / `offset` or cursor).
- Expect DB size and backups to grow faster than bucket-based architecture.

## 8) Security checklist

- Validate MIME type server-side.
- Reject suspicious files.
- Add authentication for upload/delete routes.
- Add rate limits to upload endpoint.
- Use parameterized SQL only.

## 9) Minimal Node stack

- `express` or `fastify`
- `pg`
- `multer`
- `sharp` (optional but strongly recommended)

## Summary

If you want **no buckets**, the correct logic is:

- Store image bytes in Railway Postgres (`bytea`)
- Serve bytes from your API
- Keep frontend stateless and driven by DB metadata
