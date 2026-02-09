import Link from "next/link";

export default function HomePage() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Hero roxo */}
      <div className="rounded-2xl p-6 text-white mb-6"
        style={{
          background: "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
          boxShadow: "0 14px 35px rgba(124, 58, 237, 0.22)",
        }}
      >
        <div className="text-sm opacity-90">Controle Financeiro Familiar</div>
        <h1 className="text-3xl font-bold tracking-tight mt-1">Dashboard</h1>
        <p className="text-sm opacity-90 mt-1">
          Visão geral rápida • Roxo fintech premium
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
          <div className="rounded-xl bg-white/15 p-4">
            <div className="text-xs opacity-90">Saldo do mês</div>
            <div className="text-2xl font-semibold">R$ 0,00</div>
          </div>
          <div className="rounded-xl bg-white/15 p-4">
            <div className="text-xs opacity-90">Receitas</div>
            <div className="text-2xl font-semibold">R$ 0,00</div>
          </div>
          <div className="rounded-xl bg-white/15 p-4">
            <div className="text-xs opacity-90">Despesas</div>
            <div className="text-2xl font-semibold">R$ 0,00</div>
          </div>
        </div>
      </div>

      {/* Atalhos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/lancamentos" className="brand-card p-5 hover:opacity-95 transition">
          <div className="text-lg font-semibold brand-primary">➕ Lançamentos</div>
          <div className="text-sm brand-muted">Registrar despesas e receitas</div>
        </Link>

        <Link href="/cartoes" className="brand-card p-5 hover:opacity-95 transition">
          <div className="text-lg font-semibold brand-primary">💳 Cartões</div>
          <div className="text-sm brand-muted">Limites, status e consumo</div>
        </Link>

        <Link href="/assinaturas" className="brand-card p-5 hover:opacity-95 transition">
          <div className="text-lg font-semibold brand-primary">🔁 Assinaturas</div>
          <div className="text-sm brand-muted">Recorrências no cartão até cancelar</div>
        </Link>

        <Link href="/relatorios" className="brand-card p-5 hover:opacity-95 transition">
          <div className="text-lg font-semibold brand-primary">📊 Relatórios</div>
          <div className="text-sm brand-muted">Análises e gráficos financeiros</div>
        </Link>

        <Link href="/config" className="brand-card p-5 hover:opacity-95 transition md:col-span-2">
          <div className="text-lg font-semibold brand-primary">⚙️ Configurações</div>
          <div className="text-sm brand-muted">Cadastros, categorias, contas e ajustes</div>
        </Link>
      </div>
    </div>
  );
}
