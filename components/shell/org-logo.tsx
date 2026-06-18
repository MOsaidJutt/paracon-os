"use client";

import { useState } from "react";

export function OrgLogo({ logoUrl, orgName }: { logoUrl: string | null; orgName: string }) {
  const [errored, setErrored] = useState(false);

  if (logoUrl && !errored) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote R2 URL, dimensions unknown
      <img
        src={logoUrl}
        alt={orgName}
        className="h-7 w-auto object-contain"
        onError={() => setErrored(true)}
      />
    );
  }

  // The light-mode asset has an opaque paper-coloured background baked in,
  // so it can't be reused for dark — swap to the transparent wordmark instead.
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- static asset fallback kept simple */}
      <img src="/logo-ink-on-paper.jpg" alt="Paracon" className="h-6 w-auto dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element -- static asset fallback kept simple */}
      <img
        src="/logo-white-transparent.png"
        alt="Paracon"
        className="hidden h-6 w-auto dark:block"
      />
    </>
  );
}
