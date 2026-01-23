"use client";

import { createContext, useContext, ReactNode, Suspense } from "react";
import { useReferral } from "@/hooks/useReferral";

interface ReferralContextType {
  referralCode: string | null;
  visitorId: string;
  creatorName: string | null;
  discountPercent: number | null;
  hasReferral: boolean;
  isLoading: boolean;
  clearReferral: () => void;
}

const ReferralContext = createContext<ReferralContextType | null>(null);

function ReferralProviderInner({ children }: { children: ReactNode }) {
  const referral = useReferral();

  return (
    <ReferralContext.Provider value={referral}>
      {children}
    </ReferralContext.Provider>
  );
}

export function ReferralProvider({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ReferralProviderInner>{children}</ReferralProviderInner>
    </Suspense>
  );
}

export function useReferralContext() {
  const context = useContext(ReferralContext);
  if (!context) {
    throw new Error("useReferralContext must be used within a ReferralProvider");
  }
  return context;
}
