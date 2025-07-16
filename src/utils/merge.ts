// @ts-nocheck
import mergeDeep from './mergeDeep'

const merge = (
  target: Record<string, any>,
  ...sources: Record<string, any>[]
): Record<string, any> => {
  return sources.reduce((t, s) => {
    return mergeDeep(t, s)
  }, target)
}

export default merge
