import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { FileSystemProvider } from '../contexts/FileSystemContext'
import { CompanyProvider } from '../contexts/CompanyContext'
import { GoogleDriveProvider } from '../contexts/GoogleDriveContext'

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