'use client'

type ButtonProps = {
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  size?: 'sm' | 'md'
  fullWidth?: boolean
  className?: string
  'aria-label'?: string
  children: React.ReactNode
}

export default function Button({
  onClick,
  disabled = false,
  type = 'button',
  size = 'md',
  fullWidth = false,
  className = '',
  'aria-label': ariaLabel,
  children,
}: ButtonProps) {
  const base =
    'rounded-none bg-[#d6ed9b] text-[#171917] font-semibold tracking-normal hover:bg-[#e7f9bd] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d6ed9b] disabled:opacity-50 disabled:cursor-not-allowed'
  const sz = size === 'md' ? 'text-xs py-4' : 'text-xs py-3'
  const px = fullWidth ? '' : size === 'md' ? 'px-8' : 'px-4 md:px-6'
  const w = fullWidth ? 'w-full' : ''

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={[base, sz, px, w, className].filter(Boolean).join(' ')}
    >
      {children}
    </button>
  )
}
