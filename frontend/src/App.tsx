import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'

type AlbumImage = {
  id: string
  src: string
  name: string
  addedAt: number
  heightHint: number
}

type StoredAlbumImage = Omit<AlbumImage, 'src'> & {
  file: Blob
}

const COLUMN_COUNT = 4
const DB_NAME = 'digital-album-db'
const STORE_NAME = 'album-images'
const DB_VERSION = 1

const randomHeightHint = () => 220 + Math.floor(Math.random() * 180)

const openAlbumDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open album database'))
  })

const readStoredImages = async (): Promise<StoredAlbumImage[]> => {
  const db = await openAlbumDb()
  return new Promise<StoredAlbumImage[]>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onsuccess = () => {
      const rows = request.result as unknown[]
      const validRows = rows.filter((item): item is StoredAlbumImage => {
        if (typeof item !== 'object' || item === null) {
          return false
        }

        const candidate = item as Partial<StoredAlbumImage>
        return (
          typeof candidate.id === 'string' &&
          typeof candidate.name === 'string' &&
          typeof candidate.addedAt === 'number' &&
          typeof candidate.heightHint === 'number' &&
          candidate.file instanceof Blob
        )
      })
      resolve(validRows)
    }
    request.onerror = () => reject(request.error ?? new Error('Failed to read album images'))
    transaction.oncomplete = () => db.close()
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('Album read transaction failed'))
  })
}

const saveStoredImages = async (images: StoredAlbumImage[]) => {
  const db = await openAlbumDb()
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    images.forEach((image) => {
      store.put(image)
    })

    transaction.oncomplete = () => {
      db.close()
      resolve()
    }
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('Failed to save one or more album images'))
  })
}

const clearStoredImages = async () => {
  const db = await openAlbumDb()
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).clear()
    transaction.oncomplete = () => {
      db.close()
      resolve()
    }
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('Failed to clear album images'))
  })
}

function App() {
  const [images, setImages] = useState<AlbumImage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const activeObjectUrls = useRef<string[]>([])

  useEffect(() => {
    let isMounted = true

    readStoredImages()
      .then((storedImages) => {
        if (!isMounted) {
          return
        }

        const hydratedImages = storedImages
          .sort((a, b) => b.addedAt - a.addedAt)
          .map((item) => ({
            id: item.id,
            src: URL.createObjectURL(item.file),
            name: item.name,
            addedAt: item.addedAt,
            heightHint: item.heightHint,
          }))

        setImages(hydratedImages)
      })
      .catch(() => {
        if (isMounted) {
          setErrorMessage('Unable to load saved images from storage.')
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    const nextUrls = images.map((image) => image.src)
    const staleUrls = activeObjectUrls.current.filter((url) => !nextUrls.includes(url))
    staleUrls.forEach((url) => URL.revokeObjectURL(url))
    activeObjectUrls.current = nextUrls
  }, [images])

  useEffect(() => {
    return () => {
      activeObjectUrls.current.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  const columns = useMemo(() => {
    const columnTracks = Array.from({ length: COLUMN_COUNT }, () => [] as AlbumImage[])
    const columnHeights = Array.from({ length: COLUMN_COUNT }, () => 0)

    images
      .slice()
      .sort((a, b) => b.addedAt - a.addedAt)
      .forEach((image) => {
        let shortestColumnIndex = 0

        for (let i = 1; i < columnHeights.length; i += 1) {
          if (columnHeights[i] < columnHeights[shortestColumnIndex]) {
            shortestColumnIndex = i
          }
        }

        columnTracks[shortestColumnIndex].push(image)
        columnHeights[shortestColumnIndex] += image.heightHint
      })
    return columnTracks
  }, [images])

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files
    if (!uploadedFiles?.length) {
      return
    }

    setErrorMessage('')
    const validFiles = Array.from(uploadedFiles).filter((file) =>
      file.type.startsWith('image/')
    )

    if (!validFiles.length) {
      setErrorMessage('Please upload valid image files.')
      event.target.value = ''
      return
    }

    const now = Date.now()
    const storedImages: StoredAlbumImage[] = validFiles.map((file, index) => ({
      id: `${file.name}-${now}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      name: file.name,
      addedAt: now + index,
      heightHint: randomHeightHint(),
    }))

    try {
      await saveStoredImages(storedImages)
      const newImages: AlbumImage[] = storedImages.map((item) => ({
        id: item.id,
        src: URL.createObjectURL(item.file),
        name: item.name,
        addedAt: item.addedAt,
        heightHint: item.heightHint,
      }))
      setImages((prev) => [...newImages, ...prev])
      event.target.value = ''
    } catch {
      setErrorMessage(
        'Upload failed while saving to persistent storage. Try fewer images at a time.'
      )
    }
  }

  const clearAlbum = async () => {
    try {
      await clearStoredImages()
      setImages([])
    } catch {
      setErrorMessage('Unable to clear saved album right now.')
    }
  }

  return (
    <div className="app">
      <header className="top-bar">
        <div>
          <h1>Digital Album</h1>
          <p>Upload your photos and browse them in a Pinterest-style layout.</p>
        </div>
        <div className="actions">
          <label className="upload-button">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleUpload}
              aria-label="Upload album images"
            />
            Upload Images
          </label>
          <button type="button" className="clear-button" onClick={clearAlbum}>
            Clear Album
          </button>
        </div>
      </header>

      {errorMessage ? <p className="error">{errorMessage}</p> : null}
      {isLoading ? (
        <div className="empty-state">
          <p>Loading your album...</p>
        </div>
      ) : !images.length ? (
        <div className="empty-state">
          <p>Your album is empty. Upload images to get started.</p>
        </div>
      ) : (
        <main className="gallery" aria-label="Digital album gallery">
          {columns.map((column, colIdx) => (
            <div className="column" key={`column-${colIdx}`}>
              {column.map((image) => (
                <article className="card" key={image.id}>
                  <img
                    src={image.src}
                    alt={image.name}
                    style={{ minHeight: `${image.heightHint}px` }}
                    loading="lazy"
                  />
                  <div className="caption">{image.name}</div>
                </article>
              ))}
            </div>
          ))}
        </main>
      )}

      <footer className="footer">
        Engineered by Azzy - This software is for Ri.
      </footer>
    </div>
  )
}

export default App
