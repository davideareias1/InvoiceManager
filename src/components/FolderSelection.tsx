"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { useFileSystem } from '@/infrastructure/contexts/FileSystemContext';
import { isFileSystemAccessSupported } from '@/infrastructure/filesystem/fileSystemStorage';
import { FolderOpen, RefreshCw } from 'lucide-react';

interface FolderSelectionProps {
    onFolderSelected?: () => void;
    children?: React.ReactNode;
    isDialog?: boolean;
}

export function FolderSelection({ onFolderSelected, children, isDialog = false }: FolderSelectionProps) {
    const { isInitialized, hasPermission, requestPermission, createWorkspace, resetDirectoryAccess } = useFileSystem();
    const [isLoading, setIsLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const isFSA = typeof window !== 'undefined' && isFileSystemAccessSupported();

    const handleGrantAccess = async () => {
        setIsLoading(true);
        try {
            const granted = await requestPermission();
            if (granted) {
                if (onFolderSelected) onFolderSelected();
                if (isDialog) setOpen(false);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateWorkspace = async () => {
        setIsLoading(true);
        try {
            const created = await createWorkspace();
            if (created) {
                if (onFolderSelected) onFolderSelected();
                if (isDialog) setOpen(false);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleChangeFolder = async () => {
        setIsLoading(true);
        try {
            // Reset current access and request new folder
            await resetDirectoryAccess();
            const granted = await requestPermission();
            if (granted) {
                if (onFolderSelected) onFolderSelected();
                if (isDialog) setOpen(false);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const content = (
        <div className="space-y-4">
            <div className="text-gray-600 leading-relaxed">
                {hasPermission 
                    ? "Select a different InvoiceManager folder. The folder should contain subfolders for 'invoices', 'customers', and 'products'."
                    : "Grant access to your InvoiceManager folder to load data. Select the folder that contains the subfolders 'invoices', 'customers', and 'products'."
                }
            </div>
            {!isFSA && (
                <div className="p-4 border border-gray-200 bg-gray-50 rounded">
                    <p className="text-sm text-gray-700 leading-relaxed">
                        Your browser does not support selecting a local folder. This feature is unavailable in Firefox.
                        You can still use the app to generate and download PDFs, or switch to a Chromium-based browser (Chrome, Edge, Brave) to enable folder access.
                    </p>
                </div>
            )}
        </div>
    );

    if (isDialog) {
        return (
            <AlertDialog open={open} onOpenChange={setOpen}>
                <AlertDialogTrigger asChild>
                    {children || (
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    )}
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-white border border-gray-200">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-light text-black">
                            {hasPermission ? 'Change Folder' : 'Select Folder'}
                        </AlertDialogTitle>
                    </AlertDialogHeader>
                    {content}
                    <AlertDialogFooter className="gap-3">
                        <Button
                            variant="outline"
                            onClick={() => setOpen(false)}
                            disabled={isLoading}
                            className="border-gray-300 hover:border-gray-400 font-light"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={hasPermission ? handleChangeFolder : handleGrantAccess}
                            disabled={isLoading || !isFSA}
                            className="bg-black hover:bg-gray-800 text-white border-0 font-light"
                        >
                            {isLoading ? 'Processing' : (hasPermission ? 'Change Folder' : (isFSA ? 'Select Folder' : 'Not Supported'))}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        );
    }

    if (!isInitialized) {
        return (
            <div className="h-full w-full flex items-center justify-center -translate-y-6">
                <Card className="w-full max-w-sm mx-auto border border-gray-200 bg-white shadow-sm">
                    <CardContent className="p-8">
                        <div className="flex flex-col items-center justify-center space-y-3">
                            <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm text-gray-600 font-light">Initializing</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!hasPermission) {
        return (
            <div className="h-full w-full flex items-center justify-center -translate-y-6">
                <Card className="w-full max-w-sm mx-auto border border-gray-200 bg-white shadow-sm">
                    <CardHeader className="text-center pb-4">
                        <CardTitle className="text-xl font-light text-black">
                            Select Folder
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-gray-600 text-center">
                            Choose your InvoiceManager directory
                        </p>
                        {!isFSA && (
                            <p className="text-xs text-gray-500 text-center">
                                Browser folder access not supported
                            </p>
                        )}
                    <div className="grid grid-cols-2 gap-2">
                        <Button
                            onClick={handleGrantAccess}
                            disabled={isLoading || !isFSA}
                            className="w-full bg-black hover:bg-gray-800 text-white border-0 font-light"
                        >
                            {isLoading ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Processing
                                </div>
                            ) : (
                                isFSA ? 'Select Folder' : 'Not Supported'
                            )}
                        </Button>
                        <Button
                            onClick={handleCreateWorkspace}
                            disabled={isLoading || !isFSA}
                            variant="outline"
                            className="w-full font-light"
                        >
                            First time: Create Folder
                        </Button>
                    </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // This component is only shown when no folder is selected, so this case shouldn't happen
    return null;
}
