"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserRole } from "@/hooks/useUserRole";

export default function CoordenadorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { loading, active, role } = useUserRole() as any;

  useEffect(() => {
    if (loading) return;
    const allowed = active && (role === "coordenador" || role === "admin");
    if (!allowed) router.replace("/unauthorized");
  }, [loading, active, role, router]);

  if (loading) return null;
  return <>{children}</>;
}
