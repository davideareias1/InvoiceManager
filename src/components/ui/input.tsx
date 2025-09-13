import * as React from 'react'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className = '', ...props }, ref) => {
  const classes = ['flex h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm shadow-sm', className].join(' ')
  return <input ref={ref} className={classes} {...props} />
})
Input.displayName = 'Input'
