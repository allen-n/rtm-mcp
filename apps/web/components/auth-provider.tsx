"use client";

import React from "react";

// Better-auth React client doesn't require a provider wrapper
// Just export a pass-through component for consistency
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
