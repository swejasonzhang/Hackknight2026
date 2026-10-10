/** Small SQL helpers shared by the store modules. Timestamps live in Postgres as timestamptz and cross the API as epoch milliseconds. */

/** SQL expression turning a timestamptz column into epoch milliseconds (float8, exact for whole milliseconds). */
export const ms = (column: string): string => `(extract(epoch from ${column}) * 1000)::float8`

/** SQL expression turning an epoch-milliseconds parameter or expression into a timestamptz. */
export const ts = (expr: string): string => `to_timestamp((${expr})::float8 / 1000.0)`

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** True for a well-formed UUID. Anything else can never match a row, so callers treat it as "not found". */
export function isUuid(value: string | undefined): value is string {
  return typeof value === 'string' && UUID.test(value)
}
