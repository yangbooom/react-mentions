// @ts-nocheck
import iterateMentionsMarkup from './iterateMentionsMarkup'

const getPlainText = (value: string, config: any): string => {
  let result = ''
  iterateMentionsMarkup(
    value,
    config,
    (match, index, plainTextIndex, id, display) => {
      result += display
    },
    plainText => {
      result += plainText
    }
  )
  return result
}

export default getPlainText
