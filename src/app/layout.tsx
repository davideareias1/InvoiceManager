import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { FileSystemProvider } from '../infrastructure/contexts/FileSystemContext'
import { CompanyProvider } from '../infrastructure/contexts/CompanyContext'
import { GoogleDriveProvider } from '../infrastructure/contexts/GoogleDriveContext'
import { Navigation } from '../components/Navigation'
import { FolderAccessGate } from '../components/FolderAccessGate'
import { TaxSettingsProvider } from '@/infrastructure/contexts/TaxSettingsContext'
import { TimeAnalyticsProvider } from '@/infrastructure/contexts/TimeAnalyticsContext'
import { SyncUIWrapper } from '../components/sync/SyncUIWrapper'

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
                                <TimeAnalyticsProvider>
                                    <Navigation />
                                    <main className="h-[calc(100vh-4rem)] overflow-hidden">
                                        <FolderAccessGate>
                                            <SyncUIWrapper>
                                                {children}
                                            </SyncUIWrapper>
                                        </FolderAccessGate>
                                    </main>
                                </TimeAnalyticsProvider>
                            </TaxSettingsProvider>
                        </CompanyProvider>
                    </GoogleDriveProvider>
                </FileSystemProvider>
            </body>
        </html>
    )
} 