"use client";

import React, { createContext, useContext } from "react";

export interface ConnectionState {
  connected: boolean;
  machineLabel: string | null;
  deviceId: string | null;
  eligibleCount: number;
  cooldownCount: number;
  isLoading: boolean;
  hasError: boolean;
  refresh: () => Promise<void>;
}

const ConnectionContext = createContext<ConnectionState | undefined>(undefined);

export function ConnectionProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: ConnectionState;
}) {
  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection() {
  const context = useContext(ConnectionContext);
  if (context === undefined) {
    throw new Error("useConnection must be used within a ConnectionProvider");
  }
  return context;
}
