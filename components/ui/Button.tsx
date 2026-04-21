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
    'rounded-[4px] bg-white text-black font-bold tracking-widest uppercase hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  const sz = size === 'md' ? 'text-sm py-4' : 'text-xs py-2 md:py-3'
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
