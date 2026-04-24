import React, { createContext, useCallback, useContext, useState } from 'react';

interface FieldTestContextValue {
    isTestMode: boolean;
    toggleTestMode: () => void;
}

const FieldTestContext = createContext<FieldTestContextValue | null>(null);

export function FieldTestProvider({ children }: { children: React.ReactNode }) {
    const [isTestMode, setIsTestMode] = useState(false);

    const toggleTestMode = useCallback(() => {
        setIsTestMode((prev) => !prev);
    }, []);

    return (
        <FieldTestContext.Provider value={{ isTestMode, toggleTestMode }}>
            {children}
        </FieldTestContext.Provider>
    );
}

export function useFieldTest() {
    const ctx = useContext(FieldTestContext);
    if (!ctx) throw new Error('useFieldTest must be used within FieldTestProvider');
    return ctx;
}
