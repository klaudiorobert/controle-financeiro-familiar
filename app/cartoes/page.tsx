"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Bootstrap = {
  household: { id: string; name: string; currency: string; appName: string };
};

type CreditCard = {
  id: string;
  householdId: string;
  name: string;
  bank?: string | null;
  brand?: string | null;
  last4?: string | null;
  closingDay: number;
  dueDay: number;
  limit: any; // Prisma Decimal pode vir como string
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

function toNum(v: any) {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof v === "object" && typeof v.toNumber === "function") return v.toNumber();
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatBRL(n: number) {
  const x = Number.isFinite(n) ? n : 0;
  return `R$ ${x.toFixed(2).replace(".", ",")}`;
}

function normalizeSummary(sumJson: any, cardsJson: any[]) {
  const totalLimit = toNum(sumJson?.totalLimit ?? sumJson?.totalLimit ?? 0);
  const usedLimit = toNum(sumJson?.usedLimit ?? sumJson?.usedLimit ?? 0);
  const availableLimit = toNum(sumJson?.availableLimit ?? sumJson?.availableLimit ?? 0);
  const perCard = sumJson?.perCard ?? sumJson?.cards ?? sumJson?.items ?? [];

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
  const [householdId, setHouseholdId] = useState<string>("");

  const [cards, setCards] = useState<CreditCard[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalLimit: 0,
    usedLimit: 0,
    availableLimit: 0,
  });

  async function loadAll() {
    setLoading(true);

    let boot: Bootstrap | null = null;
    let hid = householdId;

    try {
      const bRes = await fetch("/api/bootstrap", { cache: "no-store" });
      if (bRes.ok) {
        boot = (await bRes.json()) as Bootstrap;
        hid = boot?.household?.id ?? "";
        setHouseholdId(hid);
      }
    } catch {}

    const qs = hid ? `?householdId=${encodeURIComponent(hid)}` : "";

    const [cardsRes, sumRes] = await Promise.allSettled([
      fetch(`/api/credit-cards${qs}`, { cache: "no-store" }),
      fetch(`/api/credit-cards/summary${qs}`, { cache: "no-store" }),
    ]);

    let cardsJson: any = [];
    let sumJson: any = {};

    try {
      if (cardsRes.status === "fulfilled" && cardsRes.value.ok) {
        cardsJson = await cardsRes.value.json();
      }
    } catch {}

    try {
      if (sumRes.status === "fulfilled" && sumRes.value.ok) {
        sumJson = await sumRes.value.json();
      }
    } catch {}

    const cardsArr = Array.isArray(cardsJson)
      ? cardsJson
      : Array.isArray(cardsJson?.creditCards)
      ? cardsJson.creditCards
      : [];

    setCards(cardsArr);
    setSummary(normalizeSummary(sumJson, cardsArr));

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              Gerencie limites e status (formulário em página separada)
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/cartoes/fatura"
              className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50"
            >
              Fatura
            </Link>

            <Link
              href="/cartoes/novo"
              className="px-4 py-2 rounded-xl bg-black text-white hover:opacity-90"
            >
              Novo cartão
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

        {/* SUMMARY */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-sm text-gray-500">Limite total</div>
            <div className="text-2xl font-semibold mt-1">{formatBRL(summary.totalLimit)}</div>
          </div>
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-sm text-gray-500">Limite usado</div>
            <div className="text-2xl font-semibold mt-1">{formatBRL(summary.usedLimit)}</div>
          </div>
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-sm text-gray-500">Disponível</div>
            <div className="text-2xl font-semibold mt-1">{formatBRL(summary.availableLimit)}</div>
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
                const total = s?.total ?? toNum(c.limit);
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
                          <div className="text-xs text-gray-500">Total</div>
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

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={`/cartoes/fatura?creditCardId=${c.id}`}
                        className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm"
                      >
                        Ver fatura
                      </Link>

                      <Link
                        href={`/cartoes/${c.id}/editar`}
                        className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm"
                      >
                        Alterar
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="px-4 py-3 text-xs text-gray-500">
            Observação: limite usado considera parcelas em aberto (temporário).
          </div>
        </div>
      </div>
    </div>
  );
}
