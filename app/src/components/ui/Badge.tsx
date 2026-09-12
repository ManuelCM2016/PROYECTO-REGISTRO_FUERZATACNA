interface BadgeProps {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'gold' | 'brand';
  children: React.ReactNode;
  dot?: boolean;
}

export default function Badge({ variant = 'default', children, dot = false }: BadgeProps) {
  const variants = {
    success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    warning: 'bg-accent-500/20 text-accent-300 border-accent-500/40 font-semibold',
    danger: 'bg-red-500/15 text-red-400 border-red-500/30',
    info: 'bg-primary-500/20 text-primary-200 border-primary-400/30',
    brand: 'bg-primary-900/60 text-primary-100 border-primary-400/50 shadow-sm shadow-primary-950/40',
    gold: 'bg-accent-500/20 text-accent-300 border-accent-400/40 font-bold',
    default: 'bg-surface-800/80 text-primary-200 border-primary-200/20',
  };

  const dotColors = {
    success: 'bg-emerald-400',
    warning: 'bg-accent-400',
    danger: 'bg-red-400',
    info: 'bg-primary-300',
    brand: 'bg-primary-400',
    gold: 'bg-accent-400',
    default: 'bg-primary-300',
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
        border ${variants[variant]}
      `}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]} pulse-dot`} />}
      {children}
    </span>
  );
}
