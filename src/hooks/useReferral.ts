"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const REFERRAL_STORAGE_KEY = "drip_referral";
const VISITOR_ID_STORAGE_KEY = "drip_visitor_id";
const REFERRAL_EXPIRY_DAYS = 30;

interface ReferralData {
  code: string;
  visitorId: string;
  creatorName?: string;
  discountFlat?: number;
  expiresAt: number;
}

function generateVisitorId(): string {
  return `v_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") return "";

  let visitorId = localStorage.getItem(VISITOR_ID_STORAGE_KEY);
  if (!visitorId) {
    visitorId = generateVisitorId();
    localStorage.setItem(VISITOR_ID_STORAGE_KEY, visitorId);
  }
  return visitorId;
}

function getStoredReferral(): ReferralData | null {
  if (typeof window === "undefined") return null;

  const stored = localStorage.getItem(REFERRAL_STORAGE_KEY);
  if (!stored) return null;

  try {
    const data = JSON.parse(stored) as ReferralData;
    // Check if expired
    if (data.expiresAt < Date.now()) {
      localStorage.removeItem(REFERRAL_STORAGE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function storeReferral(data: ReferralData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(data));
}

export function useReferral() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function handleReferral() {
      // Check for ref parameter in URL
      const refCode = searchParams.get("ref");

      if (refCode) {
        const visitorId = getOrCreateVisitorId();

        try {
          // Validate the code with the API
          const validateRes = await fetch(
            `/api/affiliate?code=${encodeURIComponent(refCode)}`
          );
          const validateData = await validateRes.json();

          if (validateData.valid) {
            // Track the referral
            await fetch("/api/affiliate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                code: refCode,
                visitorId,
              }),
            });

            // Store referral data
            const expiresAt =
              Date.now() + REFERRAL_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
            const data: ReferralData = {
              code: validateData.code,
              visitorId,
              creatorName: validateData.creatorName,
              discountFlat: validateData.discountFlat,
              expiresAt,
            };

            storeReferral(data);
            setReferralData(data);

            // Clean up URL by removing the ref parameter
            const url = new URL(window.location.href);
            url.searchParams.delete("ref");
            router.replace(url.pathname + url.search, { scroll: false });
          }
        } catch (error) {
          console.error("Error processing referral:", error);
        }
      } else {
        // Check for stored referral
        const stored = getStoredReferral();
        if (stored) {
          setReferralData(stored);
        }
      }

      setIsLoading(false);
    }

    handleReferral();
  }, [searchParams, router]);

  const clearReferral = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(REFERRAL_STORAGE_KEY);
    }
    setReferralData(null);
  };

  return {
    referralCode: referralData?.code || null,
    visitorId: referralData?.visitorId || getOrCreateVisitorId(),
    creatorName: referralData?.creatorName || null,
    discountFlat: referralData?.discountFlat || null,
    hasReferral: !!referralData,
    isLoading,
    clearReferral,
  };
}
