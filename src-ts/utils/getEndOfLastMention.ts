// @ts-nocheck
import getMentions from './getMentions'

const getEndOfLastMention = (value: string, config: any): number => {
  const mentions = getMentions(value, config)
  const lastMention = mentions[mentions.length - 1]
  return lastMention
    ? lastMention.plainTextIndex + lastMention.display.length
    : 0
}

export default getEndOfLastMention
