export type Role = "colaborador" | "coordenador" | "gestor" | "rh" | "financeiro" | "pd" | "admin";

export type AuthState = {
  loading: boolean;
  userId: string | null;
  email: string | null;

  fullName: string | null;
  avatarUrl: string | null;

  role: Role | null;
  companyId: string | null;
  departmentId: string | null;
};
