import { redirect } from "next/navigation";

export default function DiretoriaProjetosCadastradosPage() {
  redirect("/diretoria/projetos/novo?view=edit");
}

