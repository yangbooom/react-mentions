import React, {
  Children,
  useState,
  useRef,
  useEffect,
  useCallback,
  useLayoutEffect,
} from 'react'
import ReactDOM from 'react-dom'
import {
  applyChangeToValue,
  countSuggestions,
  escapeRegex,
  findStartOfMentionInPlainText,
  getEndOfLastMention,
  getMentions,
  getPlainText,
  getSuggestionHtmlId,
  getSubstringIndex,
  isIE,
  isNumber,
  keys,
  makeMentionsMarkup,
  mapPlainTextIndex,
  omit,
  readConfigFromChildren,
  spliceString,
} from './utils'

import Highlighter from './Highlighter'
import SuggestionsOverlay from './SuggestionsOverlay'
import { defaultStyle } from './utils'

export const makeTriggerRegex = (trigger, options = {}) => {
  if (trigger instanceof RegExp) {
    return trigger
  } else {
    const { allowSpaceInQuery } = options
    const escapedTriggerChar = escapeRegex(trigger)
    return new RegExp(
      `(?:^|\\s)(${escapedTriggerChar}([^${
        allowSpaceInQuery ? '' : '\\s'
      }${escapedTriggerChar}]*))$`
    )
  }
}

const getDataProvider = (data, ignoreAccents) => {
  if (data instanceof Array) {
    return (query, callback) => {
      const results = []
      for (let i = 0, l = data.length; i < l; ++i) {
        const display = data[i].display || data[i].id
        if (getSubstringIndex(display, query, ignoreAccents) >= 0) {
          results.push(data[i])
        }
      }
      return results
    }
  } else {
    return data
  }
}

const KEY = { TAB: 9, RETURN: 13, ESC: 27, UP: 38, DOWN: 40 }

const MentionsInput = props => {
  const {
    value = '',
    onKeyDown = () => null,
    onSelect = () => null,
    onBlur = () => null,
    onChange,
    children,
    singleLine = false,
    style,
    inputComponent: CustomInput,
    inputRef: forwardedInputRef,
    suggestionsPortalHost,
    ignoreAccents = false,
    a11ySuggestionsListLabel,
    customSuggestionsContainer,
    allowSuggestionsAboveCursor = false,
    forceSuggestionsAboveCursor = false,
  } = props

  // Refs
  const inputRef = useRef(null)
  const highlighterRef = useRef(null)
  const suggestionsRef = useRef(null)
  const containerRef = useRef(null)
  const queryId = useRef(0)
  const suggestions = useRef({})
  const suggestionsMouseDown = useRef(false)
  const isComposingRef = useRef(false)

  // State
  const [focusIndex, setFocusIndex] = useState(0)
  const [selection, setSelection] = useState({ start: null, end: null })
  const [currentSuggestions, setCurrentSuggestions] = useState({})
  const [caretPosition, setCaretPosition] = useState(null)
  const [suggestionsPosition, setSuggestionsPosition] = useState({})
  const [scrollFocusedIntoView, setScrollFocusedIntoView] = useState(false)

  const plainText = getPlainText(value, readConfigFromChildren(children))

  const executeOnChange = useCallback(
    (event, ...args) => {
      if (onChange) {
        return onChange(event, ...args)
      }
      if (props.valueLink) {
        return props.valueLink.requestChange(event.target.value, ...args)
      }
    },
    [onChange, props.valueLink]
  )

  const updateSuggestions = useCallback(
    (
      localQueryId,
      childIndex,
      query,
      querySequenceStart,
      querySequenceEnd,
      plainTextValue,
      results
    ) => {
      if (localQueryId !== queryId.current) return

      suggestions.current = {
        ...suggestions.current,
        [childIndex]: {
          queryInfo: {
            childIndex,
            query,
            querySequenceStart,
            querySequenceEnd,
            plainTextValue,
          },
          results,
        },
      }

      const newSuggestionsCount = countSuggestions(suggestions.current)
      setFocusIndex(prev =>
        prev >= newSuggestionsCount
          ? Math.max(newSuggestionsCount - 1, 0)
          : prev
      )
      setCurrentSuggestions(suggestions.current)
    },
    []
  )

  const queryData = useCallback(
    (query, childIndex, querySequenceStart, querySequenceEnd, plainTextValue) => {
      const mentionChild = Children.toArray(children)[childIndex]
      const provideData = getDataProvider(mentionChild.props.data, ignoreAccents)
      const syncResult = provideData(
        query,
        updateSuggestions.bind(
          null,
          queryId.current,
          childIndex,
          query,
          querySequenceStart,
          querySequenceEnd,
          plainTextValue
        )
      )
      if (syncResult instanceof Array) {
        updateSuggestions(
          queryId.current,
          childIndex,
          query,
          querySequenceStart,
          querySequenceEnd,
          plainTextValue,
          syncResult
        )
      }
    },
    [children, ignoreAccents, updateSuggestions]
  )
  
  const clearSuggestions = useCallback(() => {
    queryId.current++
    suggestions.current = {}
    setCurrentSuggestions({})
    setFocusIndex(0)
  }, [])
  
  const updateMentionsQueries = useCallback(
    (plainTextValue, caretPosition) => {
      queryId.current++
      suggestions.current = {}
      setCurrentSuggestions({})

      const config = readConfigFromChildren(children)
      const positionInValue = mapPlainTextIndex(value, config, caretPosition, 'NULL')

      if (positionInValue === null) {
        return
      }

      const substringStartIndex = getEndOfLastMention(
        value.substring(0, positionInValue),
        config
      )
      const subString = plainTextValue.substring(
        substringStartIndex,
        caretPosition
      )

      Children.forEach(children, (child, childIndex) => {
        if (!child) return
        const regex = makeTriggerRegex(child.props.trigger, props)
        const match = subString.match(regex)
        if (match) {
          const querySequenceStart =
            substringStartIndex + subString.indexOf(match[1], match.index)
          queryData(
            match[2],
            childIndex,
            querySequenceStart,
            querySequenceStart + match[1].length,
            plainTextValue
          )
        }
      })
    },
    [children, props, queryData, value]
  )

  const handleChange = useCallback(
    ev => {
      isComposingRef.current = false
      if (isIE()) {
        const currentDocument =
          (document.activeElement && document.activeElement.contentDocument) ||
          document
        if (currentDocument.activeElement !== ev.target) {
          return
        }
      }

      const config = readConfigFromChildren(children)
      let newPlainTextValue = ev.target.value

      const newValue = applyChangeToValue(
        value,
        newPlainTextValue,
        {
          selectionStartBefore: selection.start,
          selectionEndBefore: selection.end,
          selectionEndAfter: ev.target.selectionEnd,
        },
        config
      )

      newPlainTextValue = getPlainText(newValue, config)

      let selectionStart = ev.target.selectionStart
      let selectionEnd = ev.target.selectionEnd

      let startOfMention = findStartOfMentionInPlainText(
        value,
        config,
        selectionStart
      )

      if (startOfMention !== undefined && selection.end > startOfMention) {
        selectionStart =
          startOfMention + (ev.nativeEvent.data ? ev.nativeEvent.data.length : 0)
        selectionEnd = selectionStart
      }
      
      setSelection({ start: selectionStart, end: selectionEnd })

      if (ev.nativeEvent.isComposing && selectionStart === selectionEnd) {
        updateMentionsQueries(ev.target.value, selectionStart)
      }

      const mentions = getMentions(newValue, config)
      const eventMock = { target: { value: newValue } }
      executeOnChange(eventMock, newValue, newPlainTextValue, mentions)
    },
    [children, executeOnChange, selection.end, selection.start, updateMentionsQueries, value]
  )

  const handleSelect = useCallback(
    ev => {
      setSelection({ start: ev.target.selectionStart, end: ev.target.selectionEnd })

      if (isComposingRef.current) return

      if (ev.target.selectionStart === ev.target.selectionEnd) {
        updateMentionsQueries(ev.target.value, ev.target.selectionStart)
      } else {
        clearSuggestions()
      }

      if (highlighterRef.current && inputRef.current) {
        highlighterRef.current.scrollLeft = inputRef.current.scrollLeft
        highlighterRef.current.scrollTop = inputRef.current.scrollTop
        highlighterRef.current.height = inputRef.current.height
      }

      onSelect(ev)
    },
    [clearSuggestions, onSelect, updateMentionsQueries]
  )
  
  const addMention = useCallback(
    ({ id, display }, { childIndex, querySequenceStart, querySequenceEnd, plainTextValue }) => {
        const config = readConfigFromChildren(children)
        const mentionsChild = Children.toArray(children)[childIndex]
        const { markup, displayTransform = (id, display) => display || id, appendSpaceOnAdd, onAdd } = mentionsChild.props

        const start = mapPlainTextIndex(value, config, querySequenceStart, 'START')
        const end = start + querySequenceEnd - querySequenceStart
        
        let insert = makeMentionsMarkup(markup, id, display)
        if (appendSpaceOnAdd) {
            insert += ' '
        }
        const newValue = spliceString(value, start, end, insert)

        if (inputRef.current) {
            inputRef.current.focus()
        }

        let displayValue = displayTransform(id, display)
        if (appendSpaceOnAdd) {
            displayValue += ' '
        }
        
        const newCaretPosition = querySequenceStart + displayValue.length
        setSelection({ start: newCaretPosition, end: newCaretPosition })

        const eventMock = { target: { value: newValue } }
        const mentions = getMentions(newValue, config)
        const newPlainTextValue = spliceString(
            plainTextValue,
            querySequenceStart,
            querySequenceEnd,
            displayValue
        )
        executeOnChange(eventMock, newValue, newPlainTextValue, mentions)

        if (onAdd) {
            onAdd(id, display, start, end)
        }

        clearSuggestions()
    },
    [children, clearSuggestions, executeOnChange, value]
  )

  const shiftFocus = useCallback(
    delta => {
      const suggestionsCount = countSuggestions(currentSuggestions)
      setFocusIndex(
        (suggestionsCount + focusIndex + delta) % suggestionsCount
      )
      setScrollFocusedIntoView(true)
    },
    [currentSuggestions, focusIndex]
  )

  const selectFocused = useCallback(() => {
    const { result, queryInfo } = Object.values(currentSuggestions).reduce(
        (acc, { results, queryInfo }) => [
            ...acc,
            ...results.map((result) => ({ result, queryInfo })),
        ],
        []
    )[focusIndex]
    addMention(result, queryInfo)
    setFocusIndex(0)
  }, [addMention, currentSuggestions, focusIndex])
  
  const handleKeyDown = useCallback(
    ev => {
      const suggestionsCount = countSuggestions(currentSuggestions)

      if (suggestionsCount === 0 || !suggestionsRef.current) {
        onKeyDown(ev)
        return
      }

      if (Object.values(KEY).indexOf(ev.keyCode) >= 0) {
        ev.preventDefault()
        ev.stopPropagation()
      }

      switch (ev.keyCode) {
        case KEY.ESC:
          clearSuggestions()
          break
        case KEY.DOWN:
          shiftFocus(+1)
          break
        case KEY.UP:
          shiftFocus(-1)
          break
        case KEY.RETURN:
          selectFocused()
          break
        case KEY.TAB:
          selectFocused()
          break
        default:
          break
      }
    },
    [clearSuggestions, currentSuggestions, onKeyDown, selectFocused, shiftFocus]
  )

  const handleBlur = useCallback(
    ev => {
      const clickedSuggestion = suggestionsMouseDown.current
      suggestionsMouseDown.current = false

      if (!clickedSuggestion) {
        setSelection({ start: null, end: null })
      }

      window.setTimeout(() => {
        if (highlighterRef.current && inputRef.current) {
          highlighterRef.current.scrollTop = inputRef.current.scrollTop
        }
      }, 1)

      onBlur(ev, clickedSuggestion)
    },
    [onBlur]
  )
  
  // Clipboard
  const saveSelectionToClipboard = useCallback((event) => {
    const selectionStart = inputRef.current.selectionStart
    const selectionEnd = inputRef.current.selectionEnd
    const config = readConfigFromChildren(children)
    const markupStartIndex = mapPlainTextIndex(value, config, selectionStart, 'START')
    const markupEndIndex = mapPlainTextIndex(value, config, selectionEnd, 'END')
    event.clipboardData.setData('text/plain', event.target.value.slice(selectionStart, selectionEnd))
    event.clipboardData.setData('text/react-mentions', value.slice(markupStartIndex, markupEndIndex))
  }, [children, value]);
  
  const handleCopy = useCallback((event) => {
    if (event.target !== inputRef.current) return
    if (!event.clipboardData) return
    event.preventDefault()
    saveSelectionToClipboard(event)
  }, [saveSelectionToClipboard]);

  const handleCut = useCallback((event) => {
    if (event.target !== inputRef.current) return
    if (!event.clipboardData) return
    event.preventDefault()
    saveSelectionToClipboard(event)
    
    const config = readConfigFromChildren(children)
    const markupStartIndex = mapPlainTextIndex(value, config, selection.start, 'START')
    const markupEndIndex = mapPlainTextIndex(value, config, selection.end, 'END')

    const newValue = [value.slice(0, markupStartIndex), value.slice(markupEndIndex)].join('')
    const newPlainTextValue = getPlainText(newValue, config)

    const eventMock = { target: { ...event.target, value: newPlainTextValue } }
    executeOnChange(eventMock, newValue, newPlainTextValue, getMentions(value, config))
  }, [children, executeOnChange, saveSelectionToClipboard, selection.end, selection.start, value]);

  const handlePaste = useCallback((event) => {
    if (event.target !== inputRef.current) return
    if (!event.clipboardData) return
    event.preventDefault()
    
    const config = readConfigFromChildren(children)
    const markupStartIndex = mapPlainTextIndex(value, config, selection.start, 'START')
    const markupEndIndex = mapPlainTextIndex(value, config, selection.end, 'END')

    const pastedMentions = event.clipboardData.getData('text/react-mentions')
    const pastedData = event.clipboardData.getData('text/plain')

    const newValue = spliceString(
      value,
      markupStartIndex,
      markupEndIndex,
      pastedMentions || pastedData
    ).replace(/\r/g, '')

    const newPlainTextValue = getPlainText(newValue, config)
    const eventMock = { target: { ...event.target, value: newValue } }
    executeOnChange(eventMock, newValue, newPlainTextValue, getMentions(newValue, config))

    const startOfMention = findStartOfMentionInPlainText(value, config, selection.start)
    const nextPos = (startOfMention || selection.start) + getPlainText(pastedMentions || pastedData, config).length
    setSelection({ start: nextPos, end: nextPos });
  }, [children, executeOnChange, selection.end, selection.start, value]);

  // Effects
  useEffect(() => {
    document.addEventListener('copy', handleCopy)
    document.addEventListener('cut', handleCut)
    document.addEventListener('paste', handlePaste)
    return () => {
      document.removeEventListener('copy', handleCopy)
      document.removeEventListener('cut', handleCut)
      document.removeEventListener('paste', handlePaste)
    }
  }, [handleCopy, handleCut, handlePaste])

  useLayoutEffect(() => {
    if (inputRef.current && selection.start !== null) {
      inputRef.current.setSelectionRange(selection.start, selection.end)
    }
  }, [selection])

  const updateSuggestionsPosition = useCallback(() => {
    if (!caretPosition || !suggestionsRef.current) {
      return
    }
    const getComputedStyleLengthProp = (forElement, propertyName) => {
      const length = parseFloat(
        window.getComputedStyle(forElement, null).getPropertyValue(propertyName)
      )
      return isFinite(length) ? length : 0
    }

    const suggestions = suggestionsRef.current
    const highlighter = highlighterRef.current
    const caretOffsetParentRect = highlighter.getBoundingClientRect()
    const caretHeight = getComputedStyleLengthProp(highlighter, 'font-size')
    const viewportRelative = {
      left: caretOffsetParentRect.left + caretPosition.left,
      top: caretOffsetParentRect.top + caretPosition.top + caretHeight,
    }
    const viewportHeight = Math.max(
      document.documentElement.clientHeight,
      window.innerHeight || 0
    )

    let position = {}
    if (suggestionsPortalHost) {
      position.position = 'fixed'
      let left = viewportRelative.left
      let top = viewportRelative.top
      left -= getComputedStyleLengthProp(suggestions, 'margin-left')
      top -= getComputedStyleLengthProp(suggestions, 'margin-top')
      left -= highlighter.scrollLeft
      top -= highlighter.scrollTop
      const viewportWidth = Math.max(
        document.documentElement.clientWidth,
        window.innerWidth || 0
      )
      if (left + suggestions.offsetWidth > viewportWidth) {
        position.left = Math.max(0, viewportWidth - suggestions.offsetWidth)
      } else {
        position.left = left
      }
      if (
        (allowSuggestionsAboveCursor &&
          top + suggestions.offsetHeight > viewportHeight &&
          suggestions.offsetHeight < top - caretHeight) ||
        forceSuggestionsAboveCursor
      ) {
        position.top = Math.max(0, top - suggestions.offsetHeight - caretHeight)
      } else {
        position.top = top
      }
    } else {
      let left = caretPosition.left - highlighter.scrollLeft
      let top = caretPosition.top - highlighter.scrollTop
      if (containerRef.current && left + suggestions.offsetWidth > containerRef.current.offsetWidth) {
        position.right = 0
      } else {
        position.left = left
      }
      if (
        (allowSuggestionsAboveCursor &&
          viewportRelative.top -
            highlighter.scrollTop +
            suggestions.offsetHeight >
            viewportHeight &&
          suggestions.offsetHeight <
            caretOffsetParentRect.top - caretHeight - highlighter.scrollTop) ||
        forceSuggestionsAboveCursor
      ) {
        position.top = top - suggestions.offsetHeight - caretHeight
      } else {
        position.top = top
      }
    }
    if (
      position.left === suggestionsPosition.left &&
      position.top === suggestionsPosition.top &&
      position.position === suggestionsPosition.position
    ) {
      return
    }

    setSuggestionsPosition(position)
  }, [allowSuggestionsAboveCursor, caretPosition, forceSuggestionsAboveCursor, suggestionsPortalHost, suggestionsPosition]);

  useLayoutEffect(updateSuggestionsPosition, [updateSuggestionsPosition])
  
  const setInputRef = useCallback((el) => {
      inputRef.current = el
      if (typeof forwardedInputRef === 'function') {
          forwardedInputRef(el)
      } else if (forwardedInputRef) {
          forwardedInputRef.current = el
      }
  }, [forwardedInputRef]);

  const isLoading = () => Children.toArray(children).some(child => child && child.props.isLoading)
  const isOpened = () => isNumber(selection.start) && (countSuggestions(currentSuggestions) !== 0 || isLoading())

  const uuidSuggestionsOverlay = useRef(Math.random().toString(16).substring(2)).current;

  const getInputProps = () => {
    const { readOnly, disabled } = props
    const otherProps = omit(
      props,
      ['style', 'classNames', 'className'],
      keys(MentionsInput.propTypes)
    )

    return {
      ...otherProps,
      ...style('input'),
      value: plainText,
      onScroll: () => {
        if(highlighterRef.current && inputRef.current) {
            highlighterRef.current.scrollLeft = inputRef.current.scrollLeft;
            highlighterRef.current.scrollTop = inputRef.current.scrollTop;
            highlighterRef.current.height = inputRef.current.height;
        }
      },
      ...(!readOnly &&
        !disabled && {
          onChange: handleChange,
          onSelect: handleSelect,
          onKeyDown: handleKeyDown,
          onBlur: handleBlur,
          onCompositionStart: () => { isComposingRef.current = true },
          onCompositionEnd: () => { isComposingRef.current = false },
        }),
      ...(isOpened() && {
        role: 'combobox',
        'aria-controls': uuidSuggestionsOverlay,
        'aria-expanded': true,
        'aria-autocomplete': 'list',
        'aria-haspopup': 'listbox',
        'aria-activedescendant': getSuggestionHtmlId(
          uuidSuggestionsOverlay,
          focusIndex
        ),
      }),
    }
  }

  const renderControl = () => {
    const inputProps = getInputProps()
    return (
      <div {...style('control')}>
        <Highlighter
          containerRef={highlighterRef}
          style={style('highlighter')}
          value={value}
          singleLine={singleLine}
          selectionStart={selection.start}
          selectionEnd={selection.end}
          onCaretPositionChange={setCaretPosition}
        >
          {children}
        </Highlighter>
        {CustomInput ? (
          <CustomInput ref={setInputRef} {...inputProps} />
        ) : singleLine ? (
          <input type="text" ref={setInputRef} {...inputProps} />
        ) : (
          <textarea ref={setInputRef} {...inputProps} />
        )}
      </div>
    )
  }

  const renderSuggestionsOverlay = () => {
    if (!isNumber(selection.start)) return null

    const suggestionsNode = (
      <SuggestionsOverlay
        id={uuidSuggestionsOverlay}
        style={props.style('suggestions')}
        position={suggestionsPosition.position}
        left={suggestionsPosition.left}
        top={suggestionsPosition.top}
        right={suggestionsPosition.right}
        focusIndex={focusIndex}
        scrollFocusedIntoView={scrollFocusedIntoView}
        containerRef={suggestionsRef}
        suggestions={currentSuggestions}
        customSuggestionsContainer={customSuggestionsContainer}
        onSelect={addMention}
        onMouseDown={() => { suggestionsMouseDown.current = true }}
        onMouseEnter={setFocusIndex}
        isLoading={isLoading()}
        isOpened={isOpened()}
        ignoreAccents={ignoreAccents}
        a11ySuggestionsListLabel={a11ySuggestionsListLabel}
      >
        {children}
      </SuggestionsOverlay>
    )

    return suggestionsPortalHost
      ? ReactDOM.createPortal(suggestionsNode, suggestionsPortalHost)
      : suggestionsNode
  }

  return (
    <div ref={containerRef} {...style}>
      {renderControl()}
      {renderSuggestionsOverlay()}
    </div>
  )
}

const isMobileSafari =
  typeof navigator !== 'undefined' &&
  /iPhone|iPad|iPod/i.test(navigator.userAgent)

const styled = defaultStyle(
  {
    position: 'relative',
    overflowY: 'visible',
    input: {
      display: 'block',
      width: '100%',
      position: 'absolute',
      margin: 0,
      top: 0,
      left: 0,
      boxSizing: 'border-box',
      backgroundColor: 'transparent',
      fontFamily: 'inherit',
      fontSize: 'inherit',
      letterSpacing: 'inherit',
    },
    '&multiLine': {
      input: {
        height: '100%',
        bottom: 0,
        overflow: 'hidden',
        resize: 'none',
        ...(isMobileSafari ? { marginTop: 1, marginLeft: -3 } : null),
      },
    },
  },
  ({ singleLine }) => ({
    '&singleLine': singleLine,
    '&multiLine': !singleLine,
  })
)

// propTypes are not supported in React 19 for function components,
// but we keep them here for documentation purposes.
// Consider migrating to TypeScript for type safety.
MentionsInput.propTypes = {
  singleLine: (props, propName) =>
    typeof props[propName] !== 'boolean'
      ? new Error('singleLine must be a boolean')
      : null,
  // ... other prop types
}

export default styled(MentionsInput)