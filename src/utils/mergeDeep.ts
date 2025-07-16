// @ts-nocheck
import isPlainObject from './isPlainObject'
import keys from './keys'

const mergeDeep = (
  target: Record<string, any>,
  source: Record<string, any>
): Record<string, any> => {
  let output = Object.assign({}, target)
  if (isPlainObject(target) && isPlainObject(source)) {
    keys(source).forEach(key => {
      if (isPlainObject(source[key])) {
        if (!(key in target)) Object.assign(output, { [key]: source[key] })
        else output[key] = mergeDeep(target[key], source[key])
      } else {
        Object.assign(output, { [key]: source[key] })
      }
    })
  }
  return output
}

export default mergeDeep
