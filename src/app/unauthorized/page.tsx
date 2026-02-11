export default function UnauthorizedPage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ maxWidth: 520 }}>
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>Acesso não permitido</h1>
        <p style={{ opacity: 0.8, marginBottom: 16 }}>
          Você não tem permissão para acessar esta área.
        </p>
        <a href="/" style={{ textDecoration: "underline" }}>Voltar para o início</a>
      </div>
    </main>
  );
}