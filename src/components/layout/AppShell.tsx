'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface NavItem {
    label: string
    href: string
    icon?: React.ReactNode
}

const navItems: NavItem[] = [
    { label: '图谱概览', href: '/' },
    { label: '作品管理', href: '/works' },
    { label: '添加作品', href: '/works/new' },
    { label: '证据审核页', href: '/admin/evidences' },
]

export function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)

    return (
        <div className="min-h-screen bg-transparent flex">
            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/20 z-40 lg:hidden backdrop-blur-sm"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Mobile Sidebar (only rendered when open) */}
            {isSidebarOpen && (
                <aside className="fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 shadow-lg flex flex-col lg:hidden">
                    <div className="px-6 py-6 border-b border-slate-100">
                        <h1 className="text-xl font-semibold text-slate-900">Crossover Tracker</h1>
                        <p className="mt-1 text-xs text-slate-500">跨媒介联动关系管理</p>
                    </div>
                    <nav className="flex-1 p-4 space-y-1">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setIsSidebarOpen(false)}
                                    className={cn(
                                        "flex items-center px-4 py-2.5 text-sm font-medium rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
                                        isActive
                                            ? "bg-indigo-600 text-white shadow-sm"
                                            : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                                    )}
                                >
                                    {item.label}
                                </Link>
                            )
                        })}
                    </nav>
                    <div className="p-4 border-t border-slate-100">
                        <div className="text-xs text-slate-400 text-center">v0.1.0 alpha</div>
                    </div>
                </aside>
            )}

            {/* Desktop Sidebar (always visible on lg+) */}
            <aside className="hidden lg:flex w-72 flex-col bg-white border-r border-slate-200 shadow-sm shrink-0">
                <div className="px-6 py-6 border-b border-slate-100">
                    <h1 className="text-xl font-semibold text-slate-900">Crossover Tracker</h1>
                    <p className="mt-1 text-xs text-slate-500">跨媒介联动关系管理</p>
                </div>
                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center px-4 py-2.5 text-sm font-medium rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
                                    isActive
                                        ? "bg-indigo-600 text-white shadow-sm"
                                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                                )}
                            >
                                {item.label}
                            </Link>
                        )
                    })}
                </nav>
                <div className="p-4 border-t border-slate-100">
                    <div className="text-xs text-slate-400 text-center">v0.1.0 alpha</div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Mobile Header */}
                <header className="lg:hidden h-16 bg-white border-b border-slate-200 flex items-center px-4 justify-between">
                    <span className="font-semibold text-slate-900">Crossover Tracker</span>
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 -mr-2 text-slate-600 hover:bg-slate-100 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                        type="button"
                        aria-label="打开导航菜单"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                </header>

                <main className="flex-1 overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    )
}
