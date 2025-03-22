'use client';

import React, { ReactNode, useEffect, useState } from 'react';

interface StorageProviderProps {
    children: ReactNode;
}

export default function Providers({ children }: StorageProviderProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // If not mounted yet (client-side), render nothing on the server
    if (!mounted) {
        return null;
    }

    return <>{children}</>;
} 