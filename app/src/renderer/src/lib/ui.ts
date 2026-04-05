export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md'
export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger'

export function buttonClass(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md') {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7b978a]/40 disabled:cursor-not-allowed disabled:opacity-50'

  const sizes: Record<ButtonSize, string> = {
    sm: 'h-8 px-2.5 text-[11px]',
    md: 'h-9 px-3 text-xs'
  }

  const variants: Record<ButtonVariant, string> = {
    primary: 'border-[#7b978a] bg-[#7b978a] text-[#161a18] hover:border-[#88a597] hover:bg-[#88a597]',
    secondary: 'border-[#3d4249] bg-[#262a30] text-[#eef1f4] hover:border-[#4a5058] hover:bg-[#2c3138]',
    ghost: 'border-[#34383e] bg-transparent text-[#c9d0d7] hover:border-[#40454c] hover:bg-[#23272c] hover:text-[#eef1f4]',
    danger: 'border-[#694249] bg-[#35262a] text-[#efdadd] hover:border-[#7a4f57] hover:bg-[#3e2c31]'
  }

  return `${base} ${sizes[size]} ${variants[variant]}`
}

export function iconButtonClass(variant: ButtonVariant = 'ghost', size: ButtonSize = 'sm') {
  return `${buttonClass(variant, size)} w-8 px-0`
}

export function inputClass() {
  return 'w-full rounded-md border border-[#3d4249] bg-[#1d2024] px-3 py-2 text-xs text-[#eef1f4] outline-none transition-colors placeholder:text-[#7f8791] focus:border-[#7b978a] focus:ring-2 focus:ring-[#7b978a]/20'
}

export function badgeClass(tone: BadgeTone = 'neutral') {
  const tones: Record<BadgeTone, string> = {
    neutral: 'border-[#3b4046] bg-[#262a2f] text-[#c9d0d7]',
    success: 'border-[#4b6256] bg-[#233028] text-[#cee0d5]',
    warning: 'border-[#5d5a3d] bg-[#2e2c1f] text-[#e1dcba]',
    danger: 'border-[#694249] bg-[#322226] text-[#e8cace]'
  }

  return `inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${tones[tone]}`
}
