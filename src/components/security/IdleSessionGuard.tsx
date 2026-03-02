"use client";

type Props = {
  children: React.ReactNode;
  redirectTo?: string;
};

// Compatibilidade: mantido para imports antigos.
// Controle de inatividade oficial e unico fica no AuthProvider (10 min).
export default function IdleSessionGuard({ children }: Props) {
  return <>{children}</>;
}

