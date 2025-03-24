import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { FileSystemProvider } from '../contexts/FileSystemContext'
import { CompanyProvider } from '../contexts/CompanyContext'
import { GoogleDriveProvider } from '../contexts/GoogleDriveContext'
import { MainNav } from '@/components/main-nav'
import { Toaster } from '@/components/ui/toaster'
import Script from 'next/script'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'InvoiceManager',
    description: 'Manage your invoices efficiently',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <head>
                {/* We'll load scripts dynamically in GoogleDriveContext */}
            </head>
            <body className={inter.className}>
                <FileSystemProvider>
                    <GoogleDriveProvider>
                        <CompanyProvider>
                            <div className="flex min-h-screen flex-col">
                                <div className="border-b">
                                    <div className="container flex h-16 items-center px-4">
                                        <MainNav />
                                    </div>
                                </div>
                                <main className="flex-1 container py-6 px-4">
                                    {children}
                                </main>
                            </div>
                            <Toaster />
                        </CompanyProvider>
                    </GoogleDriveProvider>
                </FileSystemProvider>
            </body>
        </html>
    )
} 