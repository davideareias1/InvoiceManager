"use client";

import { FolderSelection } from './FolderSelection';
import { useFileSystem } from '@/infrastructure/contexts/FileSystemContext';

interface FolderAccessGateProps {
    children: React.ReactNode;
}

export function FolderAccessGate({ children }: FolderAccessGateProps) {
    const { isInitialized, hasPermission } = useFileSystem();

    if (!isInitialized || !hasPermission) {
        return (
            <div className="h-full flex items-center justify-center bg-white p-6 -mt-8">
                <div className="w-full max-w-md">
                    <div className="text-center mb-12">
                        <h1 className="text-4xl font-light text-black mb-3">InvoiceManager</h1>
                        <p className="text-gray-600 text-lg">Professional invoice management</p>
                    </div>
                    <FolderSelection />
                </div>
            </div>
        );
    }

    return <>{children}</>;
}


