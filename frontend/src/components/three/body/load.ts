import bodyGzUrl from './body.bin.gz?url'
import bodyUrl from './body.bin?url'
import { decodeBody, type BodyAsset } from './figure'

/*
 * body.bin is fetched once per page, alongside the 3D code (see ../lazy.tsx), and decoded into
 * typed arrays that every figure on the page shares. A failed download leaves the scenes on their
 * fallback rather than breaking the page.
 */
let asset: BodyAsset | null = null
let pending: Promise<BodyAsset | null> | null = null

const download = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error(`body: HTTP ${res.status}`)
    return res.arrayBuffer()
  })

/** The gzip copy (about 400 KB instead of 740), unpacked here; the plain file where the browser cannot unpack it. */
export async function fetchBody(): Promise<ArrayBuffer> {
  if (typeof DecompressionStream === 'undefined') return download(bodyUrl)
  const packed = new Uint8Array(await download(bodyGzUrl))
  // A host that already unpacked it on the way (Content-Encoding: gzip) hands over the plain bytes.
  if (packed[0] !== 0x1f || packed[1] !== 0x8b) return packed.buffer
  return new Response(new Response(packed).body!.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
}

export function loadBody(): Promise<BodyAsset | null> {
  pending ??= fetchBody()
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
