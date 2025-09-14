import * as React from 'react'

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className = '', ...props }, ref) => {
    const classes = ['text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', className].join(' ')
    return <label ref={ref} className={classes} {...props} />
  }
)
Label.displayName = 'Label'
