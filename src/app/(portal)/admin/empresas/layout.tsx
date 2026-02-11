"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserRole } from "@/hooks/useUserRole";

export default function AdminEmpresasLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { loading, active, role } = useUserRole();

  useEffect(() => {
    if (loading) return;
    const allowed = active && role === "admin";
    if (!allowed) router.replace("/unauthorized");
  }, [loading, active, role, router]);

  if (loading) return null;

  return <>{children}</>;
}
