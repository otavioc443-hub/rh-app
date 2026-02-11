"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserRole } from "@/hooks/useUserRole";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";

export default function RHLayout({ children }: { children: React.ReactNode }) {
  useIdleTimeout();

  const router = useRouter();
  const { loading, active, isRH } = useUserRole();

  useEffect(() => {
    if (loading) return;
    if (!active || !isRH) router.replace("/unauthorized");
  }, [loading, active, isRH, router]);

  if (loading) return null;

  return <>{children}</>;
}
