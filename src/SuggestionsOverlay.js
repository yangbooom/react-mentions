import React, { Children, useState, useEffect, useRef } from 'react'
import { inline } from 'substyle'
import { defaultStyle } from './utils'

import { getSuggestionHtmlId } from './utils'
import Suggestion from './Suggestion'
import LoadingIndicator from './LoadingIndicator'

function SuggestionsOverlay({
  id,
  suggestions = {},
  a11ySuggestionsListLabel,
  focusIndex,
  position,
  left,
  right,
  top,
  scrollFocusedIntoView,
  isLoading,
  isOpened,
  onSelect = () => null,
  ignoreAccents,
  containerRef,
  children,
  style,
  customSuggestionsContainer,
  onMouseDown,
  onMouseEnter,
}) {
  const ulElement = useRef(null)

  useEffect(() => {
    if (
      !ulElement.current ||
      ulElement.current.offsetHeight >= ulElement.current.scrollHeight ||
      !scrollFocusedIntoView
    ) {
      return
    }
    const scrollTop = ulElement.current.scrollTop
    let { top: elTop, bottom } = ulElement.current.children[
      focusIndex
    ].getBoundingClientRect()
    const { top: topContainer } = ulElement.current.getBoundingClientRect()
    elTop = elTop - topContainer + scrollTop
    bottom = bottom - topContainer + scrollTop
    if (elTop < scrollTop) {
      ulElement.current.scrollTop = elTop
    } else if (bottom > ulElement.current.offsetHeight) {
      ulElement.current.scrollTop = bottom - ulElement.current.offsetHeight
    }
  }, [focusIndex, scrollFocusedIntoView])

  const renderSuggestion = (result, queryInfo, index) => {
    const isFocused = index === focusIndex
    const { childIndex, query } = queryInfo
    const { renderSuggestion } = Children.toArray(children)[childIndex].props
    const getID = suggestion =>
      typeof suggestion === 'string' ? suggestion : suggestion.id

    return (
      <Suggestion
        style={style('item')}
        key={`${childIndex}-${getID(result)}`}
        id={getSuggestionHtmlId(id, index)}
        query={query}
        index={index}
        ignoreAccents={ignoreAccents}
        renderSuggestion={renderSuggestion}
        suggestion={result}
        focused={isFocused}
        onClick={() => onSelect(result, queryInfo)}
        onMouseEnter={() => onMouseEnter && onMouseEnter(index)}
      />
    )
  }

  if (!isOpened) {
    return null
  }

  const suggestionsToRender = (
    <ul
      ref={ulElement}
      id={id}
      role="listbox"
      aria-label={a11ySuggestionsListLabel}
      {...style('list')}
    >
      {Object.values(suggestions).reduce(
        (accResults, { results, queryInfo }) => [
          ...accResults,
          ...results.map((result, index) =>
            renderSuggestion(result, queryInfo, accResults.length + index)
          ),
        ],
        []
      )}
    </ul>
  )
  
  return (
    <div
      {...inline({ position: position || 'absolute', left, right, top }, style)}
      onMouseDown={onMouseDown}
      ref={containerRef}
    >
      {customSuggestionsContainer
        ? customSuggestionsContainer(suggestionsToRender)
        : suggestionsToRender}
      {isLoading && <LoadingIndicator style={style('loadingIndicator')} />}
    </div>
  )
}

const styled = defaultStyle({
  zIndex: 1,
  backgroundColor: 'white',
  marginTop: 14,
  minWidth: 100,
  list: {
    margin: 0,
    padding: 0,
    listStyleType: 'none',
  },
})

export default styled(SuggestionsOverlay)