// Copies the MediaPipe WASM runtime into public/ and downloads the pose model,
// so the app works offline once installed. Safe to re-run; never fails the install.
import { cpSync, createWriteStream, existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const wasmSrc = path.join(root, 'node_modules/@mediapipe/tasks-vision/wasm')
const wasmDst = path.join(root, 'public/mediapipe/wasm')
const modelDir = path.join(root, 'public/models')
const model = {
  name: 'pose_landmarker_lite.task',
  url: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
}

if (existsSync(wasmSrc)) {
  mkdirSync(wasmDst, { recursive: true })
  cpSync(wasmSrc, wasmDst, { recursive: true })
  console.log('[assets] MediaPipe wasm -> public/mediapipe/wasm')
} else {
  console.warn('[assets] @mediapipe/tasks-vision is not installed yet; skipped the wasm copy')
}

const dst = path.join(modelDir, model.name)
if (existsSync(dst) && statSync(dst).size > 1_000_000) {
  console.log(`[assets] ${model.name} already present`)
} else {
  mkdirSync(modelDir, { recursive: true })
  try {
    const res = await fetch(model.url)
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
    await pipeline(Readable.fromWeb(res.body), createWriteStream(dst))
    console.log(`[assets] downloaded ${model.name} (${(statSync(dst).size / 1e6).toFixed(1)} MB) -> public/models`)
  } catch (err) {
    try { unlinkSync(dst) } catch { /* nothing to clean */ }
    console.warn(`[assets] could not download the pose model (${err instanceof Error ? err.message : err}).`)
    console.warn('[assets] The app falls back to the Google-hosted model at runtime. Re-run `npm run setup:assets` when online.')
  }
}
