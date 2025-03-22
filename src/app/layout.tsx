import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { FileSystemProvider } from './contexts/FileSystemContext'
import { CompanyProvider } from './contexts/CompanyContext'
import { MainNav } from '@/components/main-nav'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'E-Rechnung Invoice Manager',
    description: 'Manage your invoices efficiently',
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <FileSystemProvider>
                    <CompanyProvider>
                        <div className="flex min-h-screen flex-col bg-gradient-to-b from-gray-50 to-gray-100">
                            <header className="sticky top-0 z-40 w-full border-b bg-white/80 backdrop-blur-sm">
                                <div className="container flex h-16 items-center">
                                    <MainNav />
                                </div>
                            </header>
                            <main className="flex-1 container py-6">{children}</main>
                            <footer className="border-t py-4 bg-white/80 backdrop-blur-sm">
                                <div className="container flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground">
                                    <p>E-Rechnung Invoice Manager</p>
                                    <p>© {new Date().getFullYear()} All rights reserved</p>
                                </div>
                            </footer>
                        </div>
                        <Toaster />
                    </CompanyProvider>
                </FileSystemProvider>
            </body>
        </html>
    )
} 