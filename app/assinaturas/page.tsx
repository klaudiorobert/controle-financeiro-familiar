"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Bootstrap = {
  household: { id: string; name: string; currency: string; appName: string };
  members: { id: string; name: string; type: string }[];
  categories: { id: string; name: string; parentId: string | null; kind?: "EXPENSE" | "INCOME" }[];
  creditCards: { id: string; name: string; closingDay: number; dueDay: number }[];
};

type Subscription = {
  id: string;
  householdId: string;
  creditCardId: string;
  description: string;
  categoryId: string | null;
  memberId: string | null;
  amount: number;
  startDate: string;
  dayOfMonth: number;
  active: boolean;
  lastGeneratedMonth: string | null;
  creditCard?: { id: string; name: string; closingDay: number; dueDay: number } | null;
  category?: { id: string; name: string } | null;
  member?: { id: string; name: string; type: string } | null;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function brlToNumber(v: string) {
  const cleaned = String(v ?? "").replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function formatBRL(n: number) {
  const x = Number.isFinite(n) ? n : 0;
  return `R$ ${x.toFixed(2).replace(".", ",")}`;
}

function clampDay(v: number) {
  if (!Number.isFinite(v)) return 1;
  return Math.min(28, Math.max(1, Math.floor(v)));
}

export default function AssinaturasPage() {
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [items, setItems] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // FORM
  const [description, setDescription] = useState("");
  const [creditCardId, setCreditCardId] = useState("");
  const [amount, setAmount] = useState("0,00");
  const [dayOfMonth, setDayOfMonth] = useState<number>(5);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [memberId, setMemberId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");

  // Somente assinaturas de despesa (cartão)
  const visibleCategories = useMemo(() => {
    const cats = boot?.categories ?? [];
    const withKind = cats.some((c) => c.kind);
    if (withKind) return cats.filter((c) => c.kind === "EXPENSE");
    return cats;
  }, [boot]);

  async function loadAll() {
    setLoading(true);

    const b = await fetch("/api/bootstrap", { cache: "no-store" }).then((r) => r.json());
    setBoot(b);

    // defaults seguros
    if (b?.creditCards?.length && !creditCardId) setCreditCardId(b.creditCards[0].id);
    if (b?.members?.length && !memberId) setMemberId(b.members[0].id);
    if (b?.categories?.length && !categoryId) setCategoryId(b.categories[0].id);

    // roda assinaturas do mês (evita esquecer)
    await fetch("/api/card-subscriptions/run", { method: "POST" }).catch(() => {});

    const subs = await fetch("/api/card-subscriptions", { cache: "no-store" }).then((r) => r.json());
    setItems(Array.isArray(subs) ? subs : []);

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validate(): string | null {
    if (!boot) return "Dados carregando…";
    if (!description.trim()) return "Informe a descrição.";
    if (!creditCardId) return "Selecione o cartão.";
    const v = brlToNumber(amount);
    if (!Number.isFinite(v) || v <= 0) return "Informe um valor válido.";
    if (!startDate) return "Informe a data de início.";
    if (!dayOfMonth || dayOfMonth < 1 || dayOfMonth > 28) return "Dia do mês deve ser 1 a 28.";
    if (!categoryId) return "Selecione a categoria.";
    if (!memberId) return "Selecione o membro.";
    return null;
  }

  async function onCreate() {
    if (saving) return;
    const err = validate();
    if (err) return alert(err);
    if (!boot) return;

    setSaving(true);
    try {
      const payload = {
        householdId: boot.household.id,
        creditCardId,
        description: description.trim(),
        amount: brlToNumber(amount),
        dayOfMonth: clampDay(dayOfMonth),
        startDate,
        categoryId: categoryId || null,
        memberId: memberId || null,
        active: true,
      };

      const res = await fetch("/api/card-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`Erro ao salvar assinatura: ${json?.error ?? "desconhecido"}`);
        return;
      }

      // limpa
      setDescription("");
      setAmount("0,00");
      setDayOfMonth(5);
      setStartDate(new Date().toISOString().slice(0, 10));

      await loadAll();
    } finally {
      setSaving(false);
    }
  }

  async function onToggleActive(id: string, active: boolean) {
    const res = await fetch(`/api/card-subscriptions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(`Erro ao atualizar: ${json?.error ?? "desconhecido"}`);
      return;
    }
    await loadAll();
  }

  async function onDelete(id: string) {
    if (!confirm("Excluir essa assinatura? (não apaga lançamentos já gerados)")) return;
    const res = await fetch(`/api/card-subscriptions/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(`Erro ao excluir: ${json?.error ?? "desconhecido"}`);
      return;
    }
    await loadAll();
  }

  return (
    <div className="min-h-[calc(100vh-72px)] bg-gray-50">
      <div className="max-w-6xl mx-auto p-5 md:p-6">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-5">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Assinaturas</h1>
            <p className="text-sm text-gray-600">
              Recorrências no cartão • {boot ? boot.household.name : "carregando…"}
            </p>
          </div>

          <div className="flex gap-2">
            <Link href="/cartoes" className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50">
              Voltar aos cartões
            </Link>
            <button
              onClick={loadAll}
              className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50"
              disabled={loading}
            >
              Atualizar
            </button>
          </div>
        </div>

        {/* FORM */}
        <div className="rounded-2xl border bg-white p-5 shadow-sm mb-5">
          <div className="text-lg font-semibold mb-1">Nova assinatura</div>
          <div className="text-sm text-gray-500 mb-4">
            Você lança 1 vez e ela reaparece todo mês até cancelar.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-6">
              <label className="text-xs text-gray-600">Descrição</label>
              <input
                className="w-full border rounded-xl px-3 py-2"
                placeholder="Ex: Netflix, Spotify, iCloud…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="md:col-span-3">
              <label className="text-xs text-gray-600">Valor (R$)</label>
              <input
                className="w-full border rounded-xl px-3 py-2"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                disabled={saving}
              />
            </div>

            <div className="md:col-span-3">
              <label className="text-xs text-gray-600">Dia de cobrança (1–28)</label>
              <input
                type="number"
                min={1}
                max={28}
                className="w-full border rounded-xl px-3 py-2"
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(Number(e.target.value))}
                disabled={saving}
              />
            </div>

            <div className="md:col-span-4">
              <label className="text-xs text-gray-600">Cartão</label>
              <select
                className="w-full border rounded-xl px-3 py-2"
                value={creditCardId}
                onChange={(e) => setCreditCardId(e.target.value)}
                disabled={saving || !boot}
              >
                {(boot?.creditCards ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} • fecha {c.closingDay} • vence {c.dueDay}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-4">
              <label className="text-xs text-gray-600">Membro</label>
              <select
                className="w-full border rounded-xl px-3 py-2"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                disabled={saving || !boot}
              >
                {(boot?.members ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.type}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-4">
              <label className="text-xs text-gray-600">Categoria</label>
              <select
                className="w-full border rounded-xl px-3 py-2"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={saving || !boot}
              >
                <option value="">Selecione…</option>
                {visibleCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-4">
              <label className="text-xs text-gray-600">Início</label>
              <input
                type="date"
                className="w-full border rounded-xl px-3 py-2"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="md:col-span-8 flex items-end gap-2">
              <button
                onClick={onCreate}
                disabled={saving || !boot}
                className="px-5 py-3 rounded-xl bg-black text-white hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Salvando…" : "Salvar assinatura"}
              </button>

              <div className="text-xs text-gray-500">
                Dica: o sistema evita gerar duplicado por mês usando <b>lastGeneratedMonth</b>.
              </div>
            </div>
          </div>
        </div>

        {/* LIST */}
        <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 text-sm font-semibold">Assinaturas cadastradas</div>

          {loading ? (
            <div className="p-4 text-gray-600">Carregando…</div>
          ) : items.length === 0 ? (
            <div className="p-4 text-gray-600">Nenhuma assinatura cadastrada.</div>
          ) : (
            <div className="divide-y">
              {items.map((s) => (
                <div key={s.id} className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="font-semibold">{s.description}</div>
                        <span
                          className={cn(
                            "text-xs px-2 py-1 rounded-full border",
                            s.active
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-gray-100 text-gray-700 border-gray-200"
                          )}
                        >
                          {s.active ? "Ativa" : "Pausada"}
                        </span>
                      </div>

                      <div className="text-sm text-gray-600">
                        {formatBRL(Number(s.amount))} • dia {s.dayOfMonth} • {s.creditCard?.name ?? "Cartão"}
                      </div>

                      <div className="text-xs text-gray-500 mt-1">
                        {s.member?.name ?? "-"} • {s.category?.name ?? "-"} • início{" "}
                        {new Date(s.startDate).toLocaleDateString("pt-BR")}
                        {s.lastGeneratedMonth ? ` • última geração: ${s.lastGeneratedMonth}` : ""}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm"
                        onClick={() => onToggleActive(s.id, !s.active)}
                      >
                        {s.active ? "Pausar" : "Reativar"}
                      </button>

                      <button
                        className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm"
                        onClick={() => onDelete(s.id)}
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="px-4 py-3 text-xs text-gray-500">
            Próximo passo (lindo): mostrar “Assinaturas do mês” dentro da tela de Fatura.
          </div>
        </div>
      </div>
    </div>
  );
}
