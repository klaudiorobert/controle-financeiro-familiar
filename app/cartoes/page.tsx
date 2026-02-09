"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";


type CardStatus = "ACTIVE" | "INACTIVE";
type Brand = "Visa" | "Master" | "Elo" | "Amex" | "Hipercard" | "Other";

type Bootstrap = {
  household: { id: string; name: string; currency: string; appName: string };
};

type CreditCard = {
  id: string;
  name: string; // ex: "Santander • Visa • ****2223"
  bank?: string | null;
  brand?: string | null;
  last4?: string | null;
  closingDay: number;
  dueDay: number;
  limit: number;
  active: boolean;
};

type Summary = {
  totalLimit: number;
  usedLimit: number;
  availableLimit: number;
  perCard?: Array<{
    creditCardId: string;
    total: number;
    used: number;
    available: number;
  }>;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatBRL(n: number) {
  const x = Number.isFinite(n) ? n : 0;
  return `R$ ${x.toFixed(2).replace(".", ",")}`;
}

function brlToNumber(v: string) {
  const cleaned = String(v ?? "").replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function clampDay(v: number) {
  if (!Number.isFinite(v)) return 1;
  return Math.min(28, Math.max(1, Math.floor(v)));
}

function toNum(v: any) {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function normalizeSummary(sumJson: any, cardsJson: any[]) {
  const totalLimit =
    toNum(sumJson?.totalLimit) ??
    toNum(sumJson?.total) ??
    toNum(sumJson?.limitTotal) ??
    0;

  const usedLimit =
    toNum(sumJson?.usedLimit) ??
    toNum(sumJson?.used) ??
    toNum(sumJson?.limitUsed) ??
    0;

  const availableLimit =
    toNum(sumJson?.availableLimit) ??
    toNum(sumJson?.available) ??
    toNum(sumJson?.limitAvailable) ??
    0;

  const perCard = sumJson?.perCard ?? sumJson?.cards ?? sumJson?.items ?? [];

  // fallback: soma do limite dos cartões
  const fallbackTotal = (cardsJson ?? []).reduce(
    (acc: number, c: any) => acc + toNum(c?.limit),
    0
  );

  const finalTotal = totalLimit > 0 ? totalLimit : fallbackTotal;
  const finalUsed = usedLimit;
  const finalAvail =
    availableLimit > 0 ? availableLimit : Math.max(0, finalTotal - finalUsed);

  return {
    totalLimit: finalTotal,
    usedLimit: finalUsed,
    availableLimit: finalAvail,
    perCard: Array.isArray(perCard) ? perCard : [],
  } as Summary;
}

export default function CartoesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [householdId, setHouseholdId] = useState<string>("");

  const [cards, setCards] = useState<CreditCard[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalLimit: 0,
    usedLimit: 0,
    availableLimit: 0,
  });

  // FORM
  const [bank, setBank] = useState("");
  const [brand, setBrand] = useState<Brand>("Visa"); // ✅ consistente
  const [last4, setLast4] = useState("");
  const [closingDay, setClosingDay] = useState(5);
  const [dueDay, setDueDay] = useState(10);
  const [limit, setLimit] = useState("0,00");
  const [status, setStatus] = useState<CardStatus>("ACTIVE");

  const [editingId, setEditingId] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);

    // 1) bootstrap (householdId)
    let boot: Bootstrap | null = null;
    try {
      const bRes = await fetch("/api/bootstrap", { cache: "no-store" });
      if (bRes.ok) {
        boot = (await bRes.json()) as Bootstrap;
        setHouseholdId(boot?.household?.id ?? "");
      }
    } catch {
      // deixa seguir — não quebra tela
    }

    // 2) cards + summary
const hid = boot?.household?.id ?? householdId;

const [cardsRes, sumRes] = await Promise.allSettled([
  fetch(`/api/credit-cards?householdId=${hid}`, { cache: "no-store" }),
  fetch(`/api/credit-cards/summary?householdId=${hid}`, { cache: "no-store" }),
]);


    let cardsJson: any = [];
    let sumJson: any = {};

    try {
      if (cardsRes.status === "fulfilled") {
        if (cardsRes.value.ok) cardsJson = await cardsRes.value.json();
      }
    } catch {}

    try {
      if (sumRes.status === "fulfilled") {
        if (sumRes.value.ok) sumJson = await sumRes.value.json();
      }
    } catch {}

    const cardsArr = Array.isArray(cardsJson) ? cardsJson : [];
    setCards(cardsArr);

    const normalized = normalizeSummary(sumJson, cardsArr);
    setSummary(normalized);

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  function validate(): string | null {
    if (!householdId) return "Household não carregou (tente Atualizar).";
    if (!bank.trim()) return "Informe o banco.";
    if (!brand) return "Selecione a bandeira.";
    if (!last4.trim() || last4.trim().length !== 4) return "Informe os 4 últimos dígitos.";
    const lim = brlToNumber(limit);
    if (!Number.isFinite(lim) || lim <= 0) return "Informe um limite válido.";
    if (!closingDay) return "Informe o dia de fechamento.";
    if (!dueDay) return "Informe o dia de vencimento.";
    return null;
  }

function startEdit(card: CreditCard) {
  setEditingId(card.id);

  const bankFromName = card.name?.split("•")[0]?.trim() ?? "";

  setBank(((card.bank ?? bankFromName) ?? "").trim());
  setBrand(((card.brand as Brand) ?? "Visa"));
  setLast4(((card.last4 ?? "") as string).trim());

  setClosingDay(card.closingDay);
  setDueDay(card.dueDay);

  const lim = Number(card.limit ?? 0);
  setLimit((Number.isFinite(lim) ? lim : 0).toFixed(2).replace(".", ","));

  setStatus(card.active ? "ACTIVE" : "INACTIVE");

  const el = document.getElementById("novo-cartao");
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelEdit() {
  setEditingId(null);
  setBank("");
  setBrand("Visa");
  setLast4("");
  setClosingDay(5);
  setDueDay(10);
  setLimit("0,00");
  setStatus("ACTIVE");
}

  async function onSave() {
    if (saving) return;

    const err = validate();
    if (err) return alert(err);

    setSaving(true);

    try {
      const bankClean = bank.trim();
      const last4Clean = last4.trim();

      const payload = {
        householdId,
        bank: bankClean,
        brand,
        last4: last4Clean,
        name: `${bankClean} • ${brand} • ****${last4Clean}`, // ✅ mantém compatibilidade
        closingDay: clampDay(closingDay),
        dueDay: clampDay(dueDay),
        limit: brlToNumber(limit),
        active: status === "ACTIVE",
      };

      const method = editingId ? "PATCH" : "POST";

      const url = editingId ? `/api/credit-cards/${editingId}` : "/api/credit-cards";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(`Erro ao salvar cartão: ${json?.error ?? "desconhecido"}`);
        return;
      }

      // limpa form + atualiza
      cancelEdit();

      await loadAll();
    } finally {
      setSaving(false);
    }
  }

  const cardsById = useMemo(() => {
    const m = new Map<string, { total: number; used: number; available: number }>();
    (summary.perCard ?? []).forEach((c) => m.set(c.creditCardId, c));
    return m;
  }, [summary.perCard]);

  return (
    <div className="min-h-[calc(100vh-72px)] bg-gray-50">
      <div className="max-w-6xl mx-auto p-5 md:p-6">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-5">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Cartões</h1>
            <p className="text-sm text-gray-600">
              Limites, status e consumo do cartão (em tempo real)
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/cartoes/fatura"
              className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50"
            >
              Fatura
            </Link>

            <button
              onClick={() => {
                const el = document.getElementById("novo-cartao");
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="px-4 py-2 rounded-xl bg-black text-white hover:opacity-90"
            >
              Novo cartão
            </button>

            <button
              onClick={loadAll}
              className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50"
              disabled={loading}
            >
              Atualizar
            </button>
          </div>
        </div>

        {/* SUMMARY */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-sm text-gray-500">Limite total (todos cartões)</div>
            <div className="text-2xl font-semibold mt-1">{formatBRL(summary.totalLimit)}</div>
          </div>
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-sm text-gray-500">Limite usado</div>
            <div className="text-2xl font-semibold mt-1">{formatBRL(summary.usedLimit)}</div>
          </div>
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-sm text-gray-500">Limite disponível</div>
            <div className="text-2xl font-semibold mt-1">{formatBRL(summary.availableLimit)}</div>
          </div>
        </div>

        {/* FORM */}
        <div id="novo-cartao" className="rounded-2xl border bg-white p-5 shadow-sm mb-5">
          <div className="mb-4">
            <div className="text-lg font-semibold">Novo cartão</div>
            <div className="text-sm text-gray-500">
              Segurança: salvamos apenas os 4 últimos dígitos.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-4">
              <label className="text-xs text-gray-600">Banco</label>
              <input
                className="w-full border rounded-xl px-3 py-2"
                placeholder="Ex: Santander"
                value={bank}
                onChange={(e) => setBank(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="md:col-span-3">
              <label className="text-xs text-gray-600">Bandeira</label>
              <select
                className="w-full border rounded-xl px-3 py-2"
                value={brand}
                onChange={(e) => setBrand(e.target.value as Brand)}
                disabled={saving}
              >
                <option value="Visa">Visa</option>
                <option value="Master">Master</option>
                <option value="Elo">Elo</option>
                <option value="Amex">Amex</option>
                <option value="Hipercard">Hipercard</option>
                <option value="Other">Outro</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs text-gray-600">Final (4 dígitos)</label>
              <input
                className="w-full border rounded-xl px-3 py-2"
                placeholder="2223"
                value={last4}
                onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
                disabled={saving}
              />
            </div>

            <div className="md:col-span-1">
              <label className="text-xs text-gray-600">Fecha</label>
              <input
                type="number"
                min={1}
                max={28}
                className="w-full border rounded-xl px-3 py-2"
                value={closingDay}
                onChange={(e) => setClosingDay(Number(e.target.value))}
                disabled={saving}
              />
            </div>

            <div className="md:col-span-1">
              <label className="text-xs text-gray-600">Vence</label>
              <input
                type="number"
                min={1}
                max={28}
                className="w-full border rounded-xl px-3 py-2"
                value={dueDay}
                onChange={(e) => setDueDay(Number(e.target.value))}
                disabled={saving}
              />
            </div>

            <div className="md:col-span-3">
              <label className="text-xs text-gray-600">Limite</label>
              <input
                className="w-full border rounded-xl px-3 py-2"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                placeholder="0,00"
                disabled={saving}
              />
            </div>

            <div className="md:col-span-3">
              <label className="text-xs text-gray-600">Status</label>
              <select
                className="w-full border rounded-xl px-3 py-2"
                value={status}
                onChange={(e) => setStatus(e.target.value as CardStatus)}
                disabled={saving}
              >
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
              </select>
            </div>

            <div className="md:col-span-9 flex flex-col md:flex-row md:items-end gap-2">
              <button
                onClick={onSave}
                disabled={saving}
                className="px-5 py-3 rounded-xl bg-black text-white hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"
              >
                {saving ? "Salvando…" : editingId ? "Salvar alterações" : "Salvar"}
              </button>

              <button
  onClick={editingId ? cancelEdit : () => {
    setBank("");
    setBrand("Visa");
    setLast4("");
    setClosingDay(5);
    setDueDay(10);
    setLimit("0,00");
    setStatus("ACTIVE");
  }}
  disabled={saving}
  className="px-5 py-3 rounded-xl border bg-white hover:bg-gray-50 disabled:opacity-50"
>
  {editingId ? "Cancelar edição" : "Limpar"}
</button>

              <div className="text-xs text-gray-500 md:ml-2">
                Dica: use <b>Fecha</b> (dia de fechamento) e <b>Vence</b> (dia do pagamento).
              </div>
            </div>
          </div>
        </div>

        {/* LIST */}
        <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 text-sm font-semibold">Cartões cadastrados</div>

          {loading ? (
            <div className="p-4 text-gray-600">Carregando…</div>
          ) : cards.length === 0 ? (
            <div className="p-4 text-gray-600">Nenhum cartão cadastrado.</div>
          ) : (
            <div className="divide-y">
              {cards.map((c) => {
                const s = cardsById.get(c.id);
                const total = s?.total ?? Number(c.limit ?? 0);
                const used = s?.used ?? 0;
                const avail = s?.available ?? Math.max(0, total - used);
                const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

                return (
                  <div key={c.id} className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="font-semibold">{c.name}</div>
                          <span
                            className={cn(
                              "text-xs px-2 py-1 rounded-full border",
                              c.active
                                ? "bg-green-50 text-green-700 border-green-200"
                                : "bg-gray-100 text-gray-700 border-gray-200"
                            )}
                          >
                            {c.active ? "Ativo" : "Inativo"}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500">
                          fecha dia {c.closingDay} • vence dia {c.dueDay}
                        </div>

                        <div className="mt-3">
                          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-2 bg-black" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="text-xs text-gray-500 mt-1">{pct}% do limite utilizado</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-right">
                        <div>
                          <div className="text-xs text-gray-500">Total do limite</div>
                          <div className="font-semibold">{formatBRL(total)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Usado</div>
                          <div className="font-semibold">{formatBRL(used)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Disponível</div>
                          <div className="font-semibold">{formatBRL(avail)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <Link
                        href={`/cartoes/fatura?creditCardId=${c.id}`}
                        className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm"
                      >
                        Ver fatura
                      </Link>

                      <button
                        onClick={() => startEdit(c)}
                        className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm"
                      >
                        Alterar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="px-4 py-3 text-xs text-gray-500">
            Observação: até implementarmos “pagamento de fatura” completo, o limite usado considera as parcelas em aberto.
          </div>
        </div>
      </div>
    </div>
  );
}
