import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { FileSystemProvider } from '../infrastructure/contexts/FileSystemContext'
import { CompanyProvider } from '../infrastructure/contexts/CompanyContext'
import { GoogleDriveProvider } from '../infrastructure/contexts/GoogleDriveContext'
import { Navigation } from '../components/Navigation'
import { TaxSettingsProvider } from '@/infrastructure/contexts/TaxSettingsContext'

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
            </head>
            <body className={inter.className + " h-screen overflow-hidden"}>
                <FileSystemProvider>
                    <GoogleDriveProvider>
                        <CompanyProvider>
                            <TaxSettingsProvider>
                                <Navigation />
                                <main className="h-[calc(100vh-4rem)] overflow-hidden">
                                    {children}
                                </main>
                            </TaxSettingsProvider>
                        </CompanyProvider>
                    </GoogleDriveProvider>
                </FileSystemProvider>
            </body>
        </html>
    )
} 