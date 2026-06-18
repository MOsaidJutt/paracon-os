import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mb-8">
        {/* The light-mode asset has an opaque paper-coloured background baked
            in (matches bg-background exactly in light mode), so it can't be
            reused for dark — swap to the transparent white wordmark instead. */}
        <Image
          src="/logo-ink-on-paper.jpg"
          alt="Paracon"
          width={180}
          height={34}
          className="h-8 w-auto dark:hidden"
          priority
        />
        <Image
          src="/logo-white-transparent.png"
          alt="Paracon"
          width={180}
          height={34}
          className="hidden h-8 w-auto dark:block"
          priority
        />
      </div>
      {children}
      <p className="mt-8 text-xs text-muted-foreground">Build in Parallel</p>
    </div>
  );
}
