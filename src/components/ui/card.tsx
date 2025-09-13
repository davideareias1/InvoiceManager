import * as React from 'react'

export const Card = ({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={['rounded-xl border border-neutral-200 bg-white shadow-sm', className].join(' ')} {...props} />
)

export const CardHeader = ({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={['p-4 border-b border-neutral-200', className].join(' ')} {...props} />
)

export const CardContent = ({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={['p-4', className].join(' ')} {...props} />
)

export const CardFooter = ({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={['p-4 border-t border-neutral-200', className].join(' ')} {...props} />
)

export const CardTitle = ({ className = '', ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={['text-base font-semibold', className].join(' ')} {...props} />
)

export const CardDescription = ({ className = '', ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={['text-sm text-neutral-500', className].join(' ')} {...props} />
)
