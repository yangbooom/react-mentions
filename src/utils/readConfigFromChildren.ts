// @ts-nocheck
import { Children } from 'react'
import invariant from 'invariant'
import markupToRegex from './markupToRegex'
import countPlaceholders from './countPlaceholders'

interface ChildConfig {
  markup: string
  regex: RegExp
  displayTransform: (id: string, display: string) => string
}

const readConfigFromChildren = (children: React.ReactNode): ChildConfig[] =>
  Children.toArray(children).map(
    ({ props: { markup, regex, displayTransform } }) => ({
      markup,
      regex: regex
        ? coerceCapturingGroups(regex, markup)
        : markupToRegex(markup),
      displayTransform: displayTransform || ((id, display) => display || id),
    })
  )

// make sure that the custom regex defines the correct number of capturing groups
const coerceCapturingGroups = (regex: RegExp, markup: string): RegExp => {
  const numberOfGroups = new RegExp(regex.toString() + '|').exec('').length - 1
  const numberOfPlaceholders = countPlaceholders(markup)

  invariant(
    numberOfGroups === numberOfPlaceholders,
    `Number of capturing groups in RegExp ${regex.toString()} (${numberOfGroups}) does not match the number of placeholders in the markup '${markup}' (${numberOfPlaceholders})`
  )

  return regex
}

export default readConfigFromChildren
