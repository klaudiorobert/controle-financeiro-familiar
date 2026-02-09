"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Bootstrap = {
  household: { id: string; name: string; currency: string; appName: string };
  members: { id: string; name: string; type: string }[];
  categories: {
    id: string;
    name: string;
    parentId: string | null;
    kind?: "EXPENSE" | "INCOME";
  }[];
  // Observação: "kind" é ideal p/ filtrar no futuro. Se ainda não existir no seu backend,
  // o filtro vai ser só visual (depois a gente conecta de verdade no schema).
  accounts: { id: string; name: string; type: string }[];
  creditCards: {
    id: string;
    name: string;
    closingDay: number;
    dueDay: number;
  }[];
  conditions?: { id: string; name: string; requiresInstallments: boolean }[]; // opcional (cadastro futuro)
};

type Tx = {
  id: string;
  date: string;
  amount: number;
  description: string;
  member?: { name: string } | null;
  category?: { name: string } | null;
};

type LaunchType = "EXPENSE" | "INCOME";
type SourceType = "ACCOUNT" | "CREDIT_CARD";
type ConditionKey = "A_VISTA" | "PARCELADO" | "PERMUTADO";

const CONDITIONS: {
  key: ConditionKey;
  label: string;
  requiresInstallments: boolean;
}[] = [
  { key: "A_VISTA", label: "À vista", requiresInstallments: false },
  { key: "PARCELADO", label: "Parcelado", requiresInstallments: true },
  { key: "PERMUTADO", label: "Permutado", requiresInstallments: false },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function brlToNumber(v: string) {
  const cleaned = v.replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function formatBRL(n: number) {
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}

export default function LancamentosPage() {
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [items, setItems] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // FORM
  const [launchType, setLaunchType] = useState<LaunchType>("EXPENSE");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("0,00");

  const [condition, setCondition] = useState<ConditionKey>("A_VISTA");
  const requiresInstallments = condition === "PARCELADO";
  const [installments, setInstallments] = useState<number>(1);

  const [memberId, setMemberId] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const [sourceType, setSourceType] = useState<SourceType>("ACCOUNT");
  const [accountFromId, setAccountFromId] = useState("");
  const [creditCardId, setCreditCardId] = useState("");

  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  async function loadAll() {
    setLoading(true);
    const [b, t] = await Promise.all([
      fetch("/api/bootstrap", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/transactions", { cache: "no-store" }).then((r) => r.json()),
    ]);

    setBoot(b);
    setItems(t);
    setLoading(false);

    // defaults seguros
    if (b?.members?.length && !memberId) setMemberId(b.members[0].id);
    if (b?.categories?.length && !categoryId) setCategoryId(b.categories[0].id);
    if (b?.accounts?.length && !accountFromId)
      setAccountFromId(b.accounts[0].id);
    if (b?.creditCards?.length && !creditCardId)
      setCreditCardId(b.creditCards[0].id);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Condição → parcelas
  useEffect(() => {
    if (!requiresInstallments) setInstallments(1);
    else if (installments < 2) setInstallments(2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condition]);

  const canUseCard = (boot?.creditCards?.length ?? 0) > 0;

  // (Filtro real por tipo de categoria vem do banco; por enquanto fica pronto)
  const visibleCategories = useMemo(() => {
    const cats = boot?.categories ?? [];
    // Se no futuro existir kind, filtra:
    const withKind = cats.some((c) => c.kind);
    if (withKind) return cats.filter((c) => c.kind === launchType);
    return cats; // fallback
  }, [boot, launchType]);

  // Se trocar tipo e a categoria escolhida não existir mais no filtro, limpa
  useEffect(() => {
    if (!categoryId) return;
    const ok = visibleCategories.some((c) => c.id === categoryId);
    if (!ok) setCategoryId("");
  }, [visibleCategories, categoryId]);

  function validate(): string | null {
    if (!boot) return "Dados ainda carregando.";
    if (!date) return "Informe a data.";
    const value = brlToNumber(amount);
    if (!Number.isFinite(value) || value <= 0) return "Valor inválido.";
    if (!memberId) return "Selecione o membro da família.";
    if (!categoryId) return "Selecione a classificação (categoria).";
    if (!description.trim()) return "Informe a descrição.";

    if (requiresInstallments) {
      if (installments < 2 || installments > 24)
        return "Parcelas deve ser entre 2 e 24.";
      if (sourceType !== "CREDIT_CARD") {
        return "Parcelado faz sentido em Cartão. Se for Conta, use À vista (ou definimos outra regra).";
      }
    }

    if (sourceType === "ACCOUNT" && !accountFromId)
      return "Selecione a conta/caixa.";
    if (sourceType === "CREDIT_CARD") {
      if (!canUseCard) return "Cadastre um cartão antes de lançar no cartão.";
      if (!creditCardId) return "Selecione o cartão.";
    }

    return null;
  }

  async function onCreate() {
    const err = validate();
    if (err) return alert(err);
    if (!boot) return;

    setSaving(true);

    const fullDescription =
      notes.trim().length > 0
        ? `${description.trim()} — Obs: ${notes.trim()}`
        : description.trim();

    const dateISO = new Date(`${date}T12:00:00`).toISOString();

    const payloadBase: any = {
      householdId: boot.household.id,
      date,
      // Mantemos type no payload por compatibilidade, mas o conceito é launchType.
      type: launchType,
      amount: brlToNumber(amount),
      description: fullDescription,
      date: dateISO,
      memberId,
      categoryId,
      condition, // conceito já pronto
    };

    let endpoint = "/api/transactions";
    const payload: any = { ...payloadBase };

    if (sourceType === "ACCOUNT") {
      payload.accountFromId = accountFromId;

      // Aqui a gente ainda grava na tabela Transaction
    } else {
      endpoint = "/api/card-transactions";

      // remove campos do padrão "Transaction" que não servem pro endpoint de cartão
      delete payload.accountFromId; // segurança

      payload.creditCardId = creditCardId;

      // 🔥 nomes corretos esperados pela API:
      payload.totalAmount = brlToNumber(amount);
      payload.installmentsTotal = requiresInstallments
        ? Number(installments)
        : 1;

      // compatibilidade com a rota do cartão:
      // (a rota usa categoryId, memberId, description e date — que você já manda)
    }

    // 🔴 validação específica do cartão
    if (sourceType === "CREDIT_CARD") {
      if (!Number.isFinite(payload.totalAmount) || payload.totalAmount <= 0) {
        alert("Erro ao salvar: totalAmount inválido.");
        setSaving(false);
        return;
      }
    }
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      alert(`Erro ao salvar: ${e?.error ?? "desconhecido"}`);
      setSaving(false);
      return;
    }

    // reset suave
    setDescription("");
    setNotes("");
    setAmount("0,00");
    setCondition("A_VISTA");
    setInstallments(1);

    setSaving(false);
    await loadAll();
  }

  const total = useMemo(
    () => items.reduce((acc, t) => acc + Number(t.amount || 0), 0),
    [items],
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {boot?.household?.appName ?? "Finanças"}
          </h1>
          <p className="text-sm text-gray-600">
            Lançamentos de despesas e receitas •{" "}
            {boot ? boot.household.name : "carregando..."}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadAll}
            className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50"
          >
            Atualizar
          </button>
          <Link
            href="/cartoes"
            className="px-4 py-2 rounded-xl bg-black text-white hover:opacity-90"
          >
            Cartões
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-gray-500">Quantidade</div>
          <div className="text-2xl font-semibold">{items.length}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-gray-500">Total (lista atual)</div>
          <div className="text-2xl font-semibold">{formatBRL(total)}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-gray-500">Status</div>
          <div className="text-2xl font-semibold">
            {loading ? "Carregando…" : "OK"}
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="rounded-2xl border bg-white p-5 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <div className="text-lg font-semibold">Novo lançamento</div>
            <div className="text-sm text-gray-500">
              Preencha os campos e salve. O sistema aplica as regras
              automaticamente.
            </div>
          </div>

          {/* LaunchType Segmented */}
          <div className="inline-flex rounded-xl border bg-gray-50 p-1">
            <button
              type="button"
              onClick={() => setLaunchType("EXPENSE")}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium",
                launchType === "EXPENSE"
                  ? "bg-white shadow"
                  : "text-gray-600 hover:text-gray-900",
              )}
            >
              Despesa
            </button>
            <button
              type="button"
              onClick={() => setLaunchType("INCOME")}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium",
                launchType === "INCOME"
                  ? "bg-white shadow"
                  : "text-gray-600 hover:text-gray-900",
              )}
            >
              Receita
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Date */}
          <div className="md:col-span-3">
            <label className="text-xs text-gray-600">Data</label>
            <input
              type="date"
              className="w-full border rounded-xl px-3 py-2"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={saving}
            />
          </div>

          {/* Amount */}
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

          {/* Condition */}
          <div className="md:col-span-3">
            <label className="text-xs text-gray-600">Condição</label>
            <select
              className="w-full border rounded-xl px-3 py-2"
              value={condition}
              onChange={(e) => setCondition(e.target.value as ConditionKey)}
              disabled={saving}
            >
              {CONDITIONS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Installments */}
          <div className="md:col-span-3">
            <label className="text-xs text-gray-600">
              Nº de parcelas{" "}
              {requiresInstallments ? "" : "(oculto se não parcelado)"}
            </label>
            <input
              type="number"
              min={requiresInstallments ? 2 : 1}
              max={24}
              className={cn(
                "w-full border rounded-xl px-3 py-2",
                !requiresInstallments && "opacity-50",
              )}
              value={installments}
              onChange={(e) => setInstallments(Number(e.target.value))}
              disabled={saving || !requiresInstallments}
            />
          </div>

          {/* Member */}
          <div className="md:col-span-4">
            <label className="text-xs text-gray-600">Membro da família</label>
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

          {/* Category */}
          <div className="md:col-span-4">
            <label className="text-xs text-gray-600">Classificação</label>
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
            <div className="text-xs text-gray-500 mt-1">
              (No próximo passo, vamos filtrar isso de verdade por
              Despesa/Receita pelo cadastro.)
            </div>
          </div>

          {/* SourceType Segmented */}
          <div className="md:col-span-4">
            <label className="text-xs text-gray-600">Origem</label>
            <div className="mt-1 inline-flex w-full rounded-xl border bg-gray-50 p-1">
              <button
                type="button"
                onClick={() => setSourceType("ACCOUNT")}
                className={cn(
                  "flex-1 px-4 py-2 rounded-lg text-sm font-medium",
                  sourceType === "ACCOUNT"
                    ? "bg-white shadow"
                    : "text-gray-600 hover:text-gray-900",
                )}
                disabled={saving}
              >
                Caixa/Conta
              </button>
              <button
                type="button"
                onClick={() => setSourceType("CREDIT_CARD")}
                className={cn(
                  "flex-1 px-4 py-2 rounded-lg text-sm font-medium",
                  sourceType === "CREDIT_CARD"
                    ? "bg-white shadow"
                    : "text-gray-600 hover:text-gray-900",
                )}
                disabled={saving}
              >
                Cartão
              </button>
            </div>

            {/* Dependência de cartão */}
            {sourceType === "CREDIT_CARD" && !canUseCard && (
              <div className="mt-2 text-sm text-red-600">
                Nenhum cartão cadastrado.{" "}
                <Link href="/cartoes" className="underline">
                  Cadastrar cartão
                </Link>
              </div>
            )}
          </div>

          {/* Account/Card select */}
          <div className="md:col-span-6">
            <label className="text-xs text-gray-600">
              {sourceType === "ACCOUNT" ? "Conta / Caixa" : "Cartão"}
            </label>

            {sourceType === "ACCOUNT" ? (
              <select
                className="w-full border rounded-xl px-3 py-2"
                value={accountFromId}
                onChange={(e) => setAccountFromId(e.target.value)}
                disabled={saving || !boot}
              >
                {(boot?.accounts ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            ) : (
              <select
                className="w-full border rounded-xl px-3 py-2"
                value={creditCardId}
                onChange={(e) => setCreditCardId(e.target.value)}
                disabled={saving || !boot || !canUseCard}
              >
                {(boot?.creditCards ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} • fecha {c.closingDay} • vence {c.dueDay}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Description */}
          <div className="md:col-span-6">
            <label className="text-xs text-gray-600">Descrição</label>
            <input
              className="w-full border rounded-xl px-3 py-2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Supermercado, Salário, Combustível..."
              disabled={saving}
            />
          </div>

          {/* Notes */}
          <div className="md:col-span-6">
            <label className="text-xs text-gray-600">
              Observação (opcional)
            </label>
            <input
              className="w-full border rounded-xl px-3 py-2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: compra do mês, viagem, etc."
              disabled={saving}
            />
          </div>

          {/* Save */}
          <div className="md:col-span-6 flex items-end">
            <button
              onClick={onCreate}
              disabled={saving || !boot}
              className="w-full md:w-auto px-5 py-3 rounded-xl bg-black text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Salvando…" : "Salvar lançamento"}
            </button>
            <div className="ml-3 text-xs text-gray-500">
              {launchType === "EXPENSE" ? "Saída" : "Entrada"} •{" "}
              {requiresInstallments ? `${installments}x` : "à vista"} •{" "}
              {sourceType === "ACCOUNT" ? "conta" : "cartão"}
            </div>
          </div>
        </div>
      </div>

      {/* List (ainda: só conta /api/transactions) */}
      <div className="rounded-2xl border bg-white overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 text-sm font-semibold">
          Últimos lançamentos (conta)
        </div>

        {loading ? (
          <div className="p-4 text-gray-600">Carregando…</div>
        ) : items.length === 0 ? (
          <div className="p-4 text-gray-600">Sem lançamentos.</div>
        ) : (
          <div className="divide-y">
            {items.map((t) => (
              <div key={t.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm text-gray-500">
                      {new Date(t.date).toLocaleDateString("pt-BR")}
                    </div>
                    <div className="font-medium">{t.description}</div>
                    <div className="text-sm text-gray-500">
                      {t.member?.name ?? "-"} • {t.category?.name ?? "-"}
                    </div>
                  </div>
                  <div className="font-semibold">
                    {formatBRL(Number(t.amount))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="px-4 py-3 text-xs text-gray-500">
          Próximo passo: 7.5 — timeline unificada (Conta + Cartão) + filtros por
          Tipo/Membro/Categoria/Período.
        </div>
      </div>
    </div>
  );
}
