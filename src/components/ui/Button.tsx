import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'warning' | 'success'
    size?: 'sm' | 'md' | 'lg'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
        const variants = {
            primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm',
            secondary: 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-sm',
            ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            destructive: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm',
            warning: 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm',
            success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
        }

        const sizes = {
            sm: 'px-3 py-1.5 text-sm',
            md: 'px-4 py-2 text-sm',
            lg: 'px-6 py-3 text-base',
        }

        return (
            <button
                ref={ref}
                className={cn(
                    'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
                    variants[variant],
                    sizes[size],
                    className
                )}
                {...props}
            />
        )
    }
)
Button.displayName = 'Button'
