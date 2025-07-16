import React, { Children, useState, useEffect, useCallback } from 'react'
import { defaultStyle } from './utils'

import {
  iterateMentionsMarkup,
  mapPlainTextIndex,
  readConfigFromChildren,
  isNumber,
} from './utils'

const _generateComponentKey = (usedKeys, id) => {
  if (!usedKeys.hasOwnProperty(id)) {
    usedKeys[id] = 0
  } else {
    usedKeys[id]++
  }
  return id + '_' + usedKeys[id]
}

function Highlighter({
  selectionStart,
  selectionEnd,
  value = '',
  onCaretPositionChange,
  containerRef,
  children,
  singleLine,
  style,
}) {
  const [position, setPosition] = useState({ left: undefined, top: undefined })
  const caretElementRef = useRef(null);

  const notifyCaretPosition = useCallback(() => {
    if (!caretElementRef.current) {
      return
    }
    const { offsetLeft, offsetTop } = caretElementRef.current
    if (position.left !== offsetLeft || position.top !== offsetTop) {
        const newPosition = { left: offsetLeft, top: offsetTop }
        setPosition(newPosition)
        onCaretPositionChange(newPosition)
    }
  }, [onCaretPositionChange, position.left, position.top]);

  useEffect(() => {
    notifyCaretPosition()
  })

  const config = readConfigFromChildren(children)
  let caretPositionInMarkup
  if (selectionEnd === selectionStart) {
    caretPositionInMarkup = mapPlainTextIndex(
      value,
      config,
      selectionStart,
      'START'
    )
  }

  const resultComponents = []
  const componentKeys = {}
  let components = resultComponents
  let substringComponentKey = 0

  const renderSubstring = (string, key) => (
    <span {...style('substring')} key={key}>
      {string}
    </span>
  )
  
  const textIteratee = (substr, index) => {
    if (
      isNumber(caretPositionInMarkup) &&
      caretPositionInMarkup >= index &&
      caretPositionInMarkup <= index + substr.length
    ) {
      const splitIndex = caretPositionInMarkup - index
      components.push(
        renderSubstring(substr.substring(0, splitIndex), substringComponentKey)
      )
      components = [
        renderSubstring(substr.substring(splitIndex), substringComponentKey),
      ]
    } else {
      components.push(renderSubstring(substr, substringComponentKey))
    }
    substringComponentKey++
  }

  const mentionIteratee = (markup, index, plainTextIndex, id, display, mentionChildIndex) => {
    const key = _generateComponentKey(componentKeys, id)
    const props = { id, display, key }
    const child = Children.toArray(children)[mentionChildIndex]
    components.push(React.cloneElement(child, props))
  }
  
  iterateMentionsMarkup(value, config, mentionIteratee, textIteratee)
  
  components.push(' ')
  
  if (components !== resultComponents) {
      resultComponents.push(
          <span {...style('caret')} ref={caretElementRef} key="caret">
              {components}
          </span>
      )
  }

  return (
    <div {...style} ref={containerRef}>
      {resultComponents}
    </div>
  )
}

const styled = defaultStyle(
  {
    position: 'relative',
    boxSizing: 'border-box',
    width: '100%',
    color: 'transparent',
    overflow: 'hidden',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
    border: '1px solid transparent',
    textAlign: 'start',
    '&singleLine': {
      whiteSpace: 'pre',
      wordWrap: null,
    },
    substring: {
      visibility: 'hidden',
    },
  },
  props => ({
    '&singleLine': props.singleLine,
  })
)

export default styled(Highlighter)