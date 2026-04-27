import pg from 'pg'

const { Pool } = pg

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required. Add it to your environment variables.')
}

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false },
})

export async function ensureSchema() {
  await pool.query(`
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
  `)
}
