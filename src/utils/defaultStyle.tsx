// @ts-nocheck
import React, { ComponentType } from 'react'
import useStyles from 'substyle'

function createDefaultStyle(
  defaultStyle: Record<string, any>,
  getModifiers?: (props: any) => string[] | undefined
) {
  function enhance<P extends object>(ComponentToWrap: ComponentType<P>) {
    const DefaultStyleEnhancer = ({
      style,
      className,
      classNames,
      ...rest
    }: P & { style?: any; className?: string; classNames?: any }) => {
      const modifiers = getModifiers ? getModifiers(rest) : undefined
      const styles = useStyles(
        defaultStyle,
        { style, className, classNames },
        modifiers
      )

      return <ComponentToWrap {...rest} style={styles} />
    }
    const displayName =
      (ComponentToWrap as any).displayName || (ComponentToWrap as any).name || 'Component'
    DefaultStyleEnhancer.displayName = `defaultStyle(${displayName})`

    // return DefaultStyleEnhancer
    return React.forwardRef((props, ref) => {
      return DefaultStyleEnhancer({ ...props, ref })
    })
  }

  return enhance
}

export default createDefaultStyle
