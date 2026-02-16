'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface ComboboxOption {
    value: string
    label: string
}

interface ComboboxProps {
    value: string
    onChange: (value: string) => void
    options: ComboboxOption[]
    label?: string
    placeholder?: string
    error?: string
    className?: string
    disabled?: boolean
}

export function Combobox({
    value,
    onChange,
    options,
    label,
    placeholder = 'Select an option...',
    error,
    className,
    disabled = false
}: ComboboxProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [search, setSearch] = useState('')
    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const selectedOption = options.find(opt => opt.value === value)

    // Filter options based on search
    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(search.toLowerCase())
    )

    // Handle click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
                setSearch('') // Reset search when closing
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleSelect = (optionValue: string) => {
        onChange(optionValue)
        setIsOpen(false)
        setSearch('')
    }

    return (
        <div className={cn("w-full", className)} ref={containerRef}>
            {label && (
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    {label}
                </label>
            )}
            <div className="relative">
                <div
                    className={cn(
                        "flex h-10 w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm transition-all cursor-pointer",
                        "focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent",
                        error && "border-rose-500 focus-within:ring-rose-500",
                        disabled && "cursor-not-allowed opacity-50 bg-slate-50",
                        className
                    )}
                    onClick={() => {
                        if (!disabled) {
                            setIsOpen(!isOpen)
                            if (!isOpen) {
                                setTimeout(() => inputRef.current?.focus(), 0)
                            }
                        }
                    }}
                >
                    <span className={cn("truncate", !selectedOption && "text-slate-400")}>
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                    <svg
                        className={cn(
                            "h-4 w-4 text-slate-500 transition-transform duration-200",
                            isOpen && "transform rotate-180"
                        )}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>

                {isOpen && !disabled && (
                    <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                        <div className="sticky top-0 border-b border-slate-100 bg-white p-2">
                            <input
                                ref={inputRef}
                                type="text"
                                className="w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                placeholder="搜索..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                        {filteredOptions.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-slate-500 text-center">
                                无匹配结果
                            </div>
                        ) : (
                            filteredOptions.map((option) => (
                                <div
                                    key={option.value}
                                    className={cn(
                                        "cursor-pointer px-4 py-2 text-sm hover:bg-indigo-50 hover:text-indigo-700",
                                        option.value === value && "bg-indigo-50 text-indigo-700 font-medium"
                                    )}
                                    onClick={() => handleSelect(option.value)}
                                >
                                    {option.label}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
            {error && <p className="mt-1 text-sm text-rose-500">{error}</p>}
        </div>
    )
}
