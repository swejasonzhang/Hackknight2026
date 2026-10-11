import wasmLoaderSimd from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import wasmBinarySimd from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'
import wasmLoaderPlain from '@mediapipe/tasks-vision/vision_wasm_nosimd_internal.js?url'
import wasmBinaryPlain from '@mediapipe/tasks-vision/vision_wasm_nosimd_internal.wasm?url'
import type { PoseFrame } from './steady'

/**
 * MediaPipe's pose model, the full variant (about 9 MB), from MediaPipe's own model storage: its
 * landmarks shake much less than the lite model's, which made a curl's arm jitter. The video never
 * leaves the browser: the model runs here, and only the joint angles are saved.
 */
export const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task'

export interface PoseTracker {
  /** The person in the frame (the 33 landmarks across the picture and in metres), or null when nobody is in view. */
  detect(video: HTMLVideoElement, nowMs: number): PoseFrame | null
  close(): void
}

/**
 * Loads MediaPipe Pose Landmarker in the browser (code-split: the library and its WebAssembly
 * runtime load only on the record page, served with the app so their versions always match).
 * Uses the GPU when the browser offers it, else the CPU.
 */
export async function createPoseTracker(): Promise<PoseTracker> {
  const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision')
  const simd = await FilesetResolver.isSimdSupported()
  const fileset = simd ? { wasmLoaderPath: wasmLoaderSimd, wasmBinaryPath: wasmBinarySimd } : { wasmLoaderPath: wasmLoaderPlain, wasmBinaryPath: wasmBinaryPlain }
  const make = (delegate: 'GPU' | 'CPU') =>
    PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })
  const landmarker = await make('GPU').catch(() => make('CPU'))
  let last = -1
  return {
    detect(video, nowMs) {
      // The model needs strictly increasing timestamps.
      const t = Math.max(nowMs, last + 1)
      last = t
      let found: PoseFrame | null = null
      landmarker.detectForVideo(video, t, (result) => {
        const landmarks = result.landmarks[0]
        if (!landmarks) return
        const world = result.worldLandmarks[0]
        found = {
          landmarks: landmarks.map((p) => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility })),
          world: world ? world.map((p) => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility })) : null,
        }
      })
      return found
    },
    close() {
      landmarker.close()
    },
  }
}
