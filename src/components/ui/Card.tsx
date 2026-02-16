import { HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
    noPadding?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
    ({ className, noPadding = false, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    'bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200',
                    !noPadding && 'p-6',
                    className
                )}
                {...props}
            />
        )
    }
)
Card.displayName = 'Card'
