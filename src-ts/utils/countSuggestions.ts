// @ts-nocheck
interface Suggestions {
  [key: string]: { results: any[] }
}

const countSuggestions = (suggestions: Suggestions): number =>
  Object.values(suggestions).reduce(
    (acc, { results }) => acc + results.length,
    0
  )

export default countSuggestions
