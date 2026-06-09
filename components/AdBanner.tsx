"use client";

import { useEffect, useRef } from "react";

interface AdBannerProps {
  slot: string;
  format?: "auto" | "horizontal" | "vertical" | "rectangle";
  className?: string;
}

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

const AD_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_ID || "";

export default function AdBanner({ slot, format = "auto", className = "" }: AdBannerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!AD_CLIENT || !ref.current) return;
    try {
      const ins = ref.current.querySelector("ins");
      if (ins && !ins.getAttribute("data-adsbygoogle-status")) {
        (window.adsbygoogle = window.adsbygoogle || []).push(null);
      }
    } catch { /* ignore */ }
  }, []);

  if (!AD_CLIENT) return null;

  const styleMap = {
    auto: { display: "block" },
    horizontal: { display: "block", width: "728px", height: "90px" },
    vertical: { display: "block", width: "160px", height: "600px" },
    rectangle: { display: "block", width: "300px", height: "250px" },
  };

  return (
    <div ref={ref} className={`ad-container ${className}`}>
      <ins
        className="adsbygoogle"
        style={styleMap[format]}
        data-ad-client={AD_CLIENT}
        data-ad-slot={slot}
        data-ad-format={format === "auto" ? "auto" : undefined}
        data-full-width-responsive="true"
      />
    </div>
  );
}
