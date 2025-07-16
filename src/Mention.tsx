// @ts-nocheck
import React from 'react'
import useStyles from 'substyle'


interface MentionProps {
  display?: React.ReactNode
  style?: any
  className?: string
  classNames?: string[]
  onAdd?: (id: string, display: string) => void
  onRemove?: (id: string) => void
  renderSuggestion?: (props: any) => React.ReactNode
  trigger?: string | RegExp
  markup?: string
  displayTransform?: (id: string, display: string) => string
  allowSpaceInQuery?: boolean
  isLoading?: boolean
  appendSpaceOnAdd?: boolean
}

const defaultStyle = {
  fontWeight: 'inherit',
}

const Mention = ({ display, style, className, classNames }: MentionProps) => {
  const styles = useStyles(defaultStyle, { style, className, classNames })
  return <strong {...styles}>{display}</strong>
}


export default Mention
