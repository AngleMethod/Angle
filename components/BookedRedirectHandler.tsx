"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function BookedRedirectHandler({ onBooked }: { onBooked: () => void }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("booked") === "true") {
      onBooked();
    }
  }, [searchParams, onBooked]);

  return null;
}
