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

## Endpoints

- `GET /api/health`
- `GET /api/images`
- `GET /api/images/:id/content`
- `POST /api/images` (`multipart/form-data`, field name: `images`, supports multiple)
- `DELETE /api/images/:id`
- `DELETE /api/images`
