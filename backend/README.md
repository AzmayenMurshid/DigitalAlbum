# Backend API

This backend stores uploaded images directly in Postgres (`bytea`) without buckets.

## Required env vars

- `DATABASE_URL` (required)
- `PORT` (optional, default: `3001`)
- `MAX_UPLOAD_MB` (optional, default: `10`)
- `PGSSL` (optional, set `false` locally if needed)

## Run

```bash
npm install
npm run dev
```

## Run with Docker

```bash
docker build -t digitalalbum-backend ./backend
docker run --rm -p 3001:3001 --env-file ./backend/.env digitalalbum-backend
```

At minimum, set `DATABASE_URL` in `backend/.env`.

## Endpoints

- `GET /api/health`
- `GET /api/images`
- `GET /api/images/:id/content`
- `POST /api/images` (`multipart/form-data`, field name: `images`, supports multiple)
- `DELETE /api/images/:id`
- `DELETE /api/images`
