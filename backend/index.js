import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import multer from 'multer'
import { ensureSchema, pool } from './db.js'

dotenv.config()

const app = express()
const port = Number(process.env.PORT ?? 3001)
const maxUploadMb = Number(process.env.MAX_UPLOAD_MB ?? 10)
const maxUploadBytes = maxUploadMb * 1024 * 1024

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadBytes },
})

app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/images', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `select id, original_name, mime_type, size_bytes, width, height, created_at
       from album_images
       order by created_at desc`
    )
    res.json(rows)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to fetch images' })
  }
})

app.get('/api/images/:id/content', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `select mime_type, image_data from album_images where id = $1`,
      [req.params.id]
    )

    if (!rows.length) {
      res.status(404).json({ error: 'Image not found' })
      return
    }

    const image = rows[0]
    res.setHeader('Content-Type', image.mime_type)
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.send(image.image_data)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to fetch image content' })
  }
})

app.post('/api/images', upload.array('images', 20), async (req, res) => {
  try {
    const files = req.files
    if (!Array.isArray(files) || !files.length) {
      res.status(400).json({ error: 'No image files provided' })
      return
    }

    const invalid = files.find((file) => !file.mimetype.startsWith('image/'))
    if (invalid) {
      res.status(400).json({ error: 'Only image files are allowed' })
      return
    }

    const client = await pool.connect()
    try {
      await client.query('begin')
      const insertedRows = []

      for (const file of files) {
        const result = await client.query(
          `insert into album_images (
            original_name, mime_type, size_bytes, image_data
          ) values ($1, $2, $3, $4)
          returning id, original_name, mime_type, size_bytes, width, height, created_at`,
          [file.originalname, file.mimetype, file.size, file.buffer]
        )
        insertedRows.push(result.rows[0])
      }

      await client.query('commit')
      res.status(201).json(insertedRows)
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: `File too large. Max size is ${maxUploadMb} MB.` })
      return
    }

    console.error(error)
    res.status(500).json({ error: 'Failed to upload image(s)' })
  }
})

app.delete('/api/images/:id', async (req, res) => {
  try {
    const result = await pool.query(`delete from album_images where id = $1`, [req.params.id])
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Image not found' })
      return
    }
    res.status(204).send()
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to delete image' })
  }
})

app.delete('/api/images', async (_req, res) => {
  try {
    await pool.query(`delete from album_images`)
    res.status(204).send()
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to clear album' })
  }
})

async function startServer() {
  await ensureSchema()
  app.listen(port, () => {
    console.log(`Backend API running on http://localhost:${port}`)
  })
}

startServer().catch((error) => {
  console.error('Server startup failed', error)
  process.exit(1)
})
