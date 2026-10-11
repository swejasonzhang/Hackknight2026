import bodyUrl from './body.bin?url'
import { decodeBody, type BodyAsset } from './figure'

/*
 * body.bin is fetched once per page, alongside the 3D code (see ../lazy.tsx), and decoded into
 * typed arrays that every figure on the page shares. A failed download leaves the scenes on their
 * fallback rather than breaking the page.
 */
let asset: BodyAsset | null = null
let pending: Promise<BodyAsset | null> | null = null

export function loadBody(): Promise<BodyAsset | null> {
  pending ??= fetch(bodyUrl)
    .then((res) => {
      if (!res.ok) throw new Error(`body.bin: HTTP ${res.status}`)
      return res.arrayBuffer()
    })
    .then((buffer) => (asset = decodeBody(buffer)))
    .catch(() => {
      // Try again on the next scene rather than never.
      pending = null
      return null
    })
  return pending
}

/** The decoded body, once `loadBody` has finished; null before then or after a failed download. */
export function bodyAsset(): BodyAsset | null {
  return asset
}
