// @ts-nocheck
const omit = (
  obj: Record<string, any>,
  ...rest: (string | string[])[]
): Record<string, any> => {
  const keys = ([] as string[]).concat(...rest)
  return Object.keys(obj).reduce((acc, k) => {
    if (obj.hasOwnProperty(k) && !keys.includes(k) && obj[k] !== undefined) {
      acc[k] = obj[k]
    }
    return acc
  }, {})
}

export default omit
