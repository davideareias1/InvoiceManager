import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { FileSystemProvider } from '../infrastructure/contexts/FileSystemContext'
import { CompanyProvider } from '../infrastructure/contexts/CompanyContext'
import { GoogleDriveProvider } from '../infrastructure/contexts/GoogleDriveContext'

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
            <body className={inter.className}>
                <FileSystemProvider>
                    <GoogleDriveProvider>
                        <CompanyProvider>
                            <main>
                                {children}
                            </main>
                        </CompanyProvider>
                    </GoogleDriveProvider>
                </FileSystemProvider>
            </body>
        </html>
    )
} 