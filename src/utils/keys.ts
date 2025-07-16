// @ts-nocheck
const keys = (obj: unknown): string[] => {
  return obj === Object(obj) ? Object.keys(obj as any) : []
}

export default keys
