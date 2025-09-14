import * as React from 'react'

export interface SwitchProps {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
  id?: string
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked = false, onCheckedChange, disabled = false, className = '', id }, ref) => {
    const handleClick = () => {
      if (!disabled && onCheckedChange) {
        onCheckedChange(!checked)
      }
    }

    const classes = [
      'inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent',
      'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2',
      'focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50',
      checked ? 'bg-neutral-900' : 'bg-neutral-200',
      className
    ].join(' ')

    const thumbClasses = [
      'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform',
      checked ? 'translate-x-5' : 'translate-x-0'
    ].join(' ')

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={classes}
        onClick={handleClick}
        id={id}
      >
        <span className={thumbClasses} />
      </button>
    )
  }
)
Switch.displayName = 'Switch'
