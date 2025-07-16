// @ts-nocheck
const isPlainObject = (obj: unknown): obj is Record<string, any> =>
  !(obj instanceof Date) && obj === Object(obj) && !Array.isArray(obj)

export default isPlainObject
