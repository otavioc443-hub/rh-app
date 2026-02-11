"use client";

import { useIdleTimeout } from "@/hooks/useIdleTimeout";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useIdleTimeout();

  return <>{children}</>;
}
