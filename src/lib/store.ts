import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { log } from './logger'

export interface StoreImage {
  filename: string
  subfolder: string
  type: string
}

export interface StoreVideo {
  filename: string
  subfolder: string
  type: string
  format?: string
}

export interface StoreEntry {
  promptId: string
  prompt: string
  type: 'image' | 'video'
  timestamp: number
  images: StoreImage[]
  videos: StoreVideo[]
}

const STORE_DIR = join(process.cwd(), 'data')
const STORE_PATH = join(STORE_DIR, 'history.json')

function read(): { entries: StoreEntry[] } {
  try {
    if (!existsSync(STORE_PATH)) return { entries: [] }
    return JSON.parse(readFileSync(STORE_PATH, 'utf-8'))
  } catch {
    return { entries: [] }
  }
}

function write(store: { entries: StoreEntry[] }): void {
  mkdirSync(STORE_DIR, { recursive: true })
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8')
}

export function saveJob(promptId: string, prompt: string, type: 'image' | 'video'): void {
  const store = read()
  if (store.entries.some((e) => e.promptId === promptId)) return
  store.entries.push({ promptId, prompt, type, timestamp: Date.now(), images: [], videos: [] })
  write(store)
  log('store', `saved job ${promptId} (${type})`)
}

export function completeJob(promptId: string, images: StoreImage[], videos: StoreVideo[]): void {
  const store = read()
  const entry = store.entries.find((e) => e.promptId === promptId)
  if (!entry) return
  if (entry.images.length > 0 || entry.videos.length > 0) return // already complete
  entry.images = images
  entry.videos = videos
  write(store)
  log('store', `completed job ${promptId} — ${images.length} images, ${videos.length} videos`)
}

export function getEntries(): StoreEntry[] {
  return read().entries.sort((a, b) => b.timestamp - a.timestamp)
}
