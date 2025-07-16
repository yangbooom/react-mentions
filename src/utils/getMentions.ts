// @ts-nocheck
import iterateMentionsMarkup from './iterateMentionsMarkup'

interface Mention {
  id: string
  display: string
  childIndex: number
  index: number
  plainTextIndex: number
}

const getMentions = (value: string, config: any): Mention[] => {
  const mentions = []
  iterateMentionsMarkup(
    value,
    config,
    (match, index, plainTextIndex, id, display, childIndex, start) => {
      mentions.push({
        id: id,
        display: display,
        childIndex: childIndex,
        index: index,
        plainTextIndex: plainTextIndex,
      })
    }
  )
  return mentions
}

export default getMentions
