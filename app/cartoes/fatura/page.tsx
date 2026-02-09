"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function formatBRL(n: number) {
  const x = Number.isFinite(n) ? n : 0;
  return `R$ ${x.toFixed(2).replace(".", ",")}`;
}

function yyyymm(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function addMonths(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, (m - 1) + delta, 1);
  return yyyymm(d);
}

function parseMoneyBR(v: string) {
  const cleaned = v.replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

type Boot = {
  household: { id: string; name: string; currency: string; appName: string };
  accounts: { id: string; name: string; type: string }[];
  creditCards: { id: string; name: string; closingDay: number; dueDay: number }[];
};

type InvoiceItem = {
  id: string;
  date: string;
  description: string | null;
  category: string | null;
  member: string | null;
  totalAmount: number;
  installmentsTotal: number;
  installmentNumber: number;
  amountThisInstallment: number;
  statementMonth: string;
};

type InvoiceResponse = {
  card: { id: string; name: string; closingDay: number; dueDay: number; active: boolean };
  statementMonth: string;
  total: number;
  paid: number;
  remaining: number;
  items: InvoiceItem[];
};

export default function FaturaCartaoPage() {
  const [boot, setBoot] = useState<Boot | null>(null);
  const [loading, setLoading] = useState(true);

  const [creditCardId, setCreditCardId] = useState("");
  const [statementMonth, setStatementMonth] = useState(() => yyyymm(new Date()));

  const [invoice, setInvoice] = useState<InvoiceResponse | null>(null);

  const [paying, setPaying] = useState(false);
  const [paidFromAccountId, setPaidFromAccountId] = useState("");
  const [payAmount, setPayAmount] = useState("0,00");

  async function loadBoot() {
    const b = await fetch("/api/bootstrap", { cache: "no-store" }).then((r) => r.json());
    setBoot(b);

    if (b?.creditCards?.length && !creditCardId) setCreditCardId(b.creditCards[0].id);
    if (b?.accounts?.length && !paidFromAccountId) setPaidFromAccountId(b.accounts[0].id);
  }

  async function loadInvoice(cardId: string, ym: string) {
    if (!cardId) return;
    setLoading(true);
    const res = await fetch(`/api/credit-cards/invoice?creditCardId=${cardId}&statementMonth=${ym}`, {
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json?.error ?? "Erro ao carregar fatura");
      setInvoice(null);
      setLoading(false);
      return;
    }
    setInvoice(json);
    // sugestão: pré-preencher valor restante
    setPayAmount(String((Number(json.remaining) || 0).toFixed(2)).replace(".", ","));
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      await loadBoot();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!creditCardId) return;
    loadInvoice(creditCardId, statementMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creditCardId, statementMonth]);

  const cards = boot?.creditCards ?? [];
  const accounts = boot?.accounts ?? [];

  const remaining = invoice?.remaining ?? 0;

  async function payInvoice() {
    if (paying) return;
    if (!invoice) return;

    const amountNum = parseMoneyBR(payAmount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) return alert("Valor inválido.");
    if (amountNum > remaining + 1e-9) return alert("Valor maior que o restante.");

    if (!paidFromAccountId) return alert("Selecione a conta para pagar.");

    setPaying(true);
    try {
      const res = await fetch("/api/credit-cards/pay-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creditCardId: invoice.card.id,
          statementMonth: invoice.statementMonth,
          paidFromAccountId,
          amount: amountNum,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        alert(json?.error ?? "Erro ao pagar");
        return;
      }

      // Recarrega fatura
      await loadInvoice(invoice.card.id, invoice.statementMonth);
      alert("Pagamento registrado!");
    } finally {
      setPaying(false);
    }
  }

  const badge = useMemo(() => {
    if (!invoice) return null;
    if (invoice.remaining <= 0.000001) return { text: "Fatura paga", cls: "bg-green-100 text-green-700 border-green-200" };
    if (invoice.paid > 0) return { text: "Parcial", cls: "bg-yellow-100 text-yellow-700 border-yellow-200" };
    return { text: "Em aberto", cls: "bg-gray-100 text-gray-700 border-gray-200" };
  }, [invoice]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fatura do Cartão</h1>
          <p className="text-sm text-gray-600">
            Visualize parcelas por mês e registre pagamento • {boot?.household?.name ?? "carregando..."}
          </p>
        </div>

        <div className="flex gap-2">
          <Link href="/cartoes" className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50">
            Voltar
          </Link>
          <Link href="/lancamentos" className="px-4 py-2 rounded-xl bg-black text-white hover:opacity-90">
            Lançamentos
          </Link>
        </div>
      </div>

      {/* Seletor */}
      <div className="rounded-2xl border bg-white p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6">
            <label className="text-xs text-gray-600">Cartão</label>
            <select
              className="w-full border rounded-xl px-3 py-2"
              value={creditCardId}
              onChange={(e) => setCreditCardId(e.target.value)}
              disabled={!boot}
            >
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} • fecha {c.closingDay} • vence {c.dueDay}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-6">
            <label className="text-xs text-gray-600">Mês da fatura</label>
            <div className="flex gap-2">
              <button
                className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50"
                onClick={() => setStatementMonth((m) => addMonths(m, -1))}
              >
                ◀
              </button>
              <input
                className="flex-1 border rounded-xl px-3 py-2"
                value={statementMonth}
                onChange={(e) => setStatementMonth(e.target.value)}
                placeholder="YYYY-MM"
              />
              <button
                className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50"
                onClick={() => setStatementMonth((m) => addMonths(m, 1))}
              >
                ▶
              </button>
            </div>
            <div className="text-xs text-gray-500 mt-1">Formato: YYYY-MM (ex: 2026-02)</div>
          </div>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-gray-500">Total da fatura</div>
          <div className="text-2xl font-semibold">{formatBRL(invoice?.total ?? 0)}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-gray-500">Pago</div>
          <div className="text-2xl font-semibold">{formatBRL(invoice?.paid ?? 0)}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Restante</div>
              <div className="text-2xl font-semibold">{formatBRL(invoice?.remaining ?? 0)}</div>
            </div>
            {badge && (
              <span className={`text-xs px-3 py-1 rounded-full border ${badge.cls}`}>
                {badge.text}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Pagamento */}
      <div className="rounded-2xl border bg-white p-5 mb-6">
        <div className="text-lg font-semibold mb-3">Pagar fatura</div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6">
            <label className="text-xs text-gray-600">Pagar com a conta</label>
            <select
              className="w-full border rounded-xl px-3 py-2"
              value={paidFromAccountId}
              onChange={(e) => setPaidFromAccountId(e.target.value)}
              disabled={!boot || paying}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4">
            <label className="text-xs text-gray-600">Valor</label>
            <input
              className="w-full border rounded-xl px-3 py-2"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              disabled={!invoice || paying}
            />
          </div>

          <div className="md:col-span-2 flex items-end">
            <button
              onClick={payInvoice}
              disabled={!invoice || paying || (invoice?.remaining ?? 0) <= 0.000001}
              className="w-full px-4 py-3 rounded-xl bg-black text-white hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"
            >
              {paying ? "Pagando…" : "Pagar"}
            </button>
          </div>
        </div>
        <div className="text-xs text-gray-500 mt-2">
          (Por enquanto o pagamento só registra em InvoicePayment. No próximo passo a gente baixa saldo da conta e libera limite com mais precisão.)
        </div>
      </div>

      {/* Itens */}
      <div className="rounded-2xl border bg-white overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 text-sm font-semibold">
          Itens da fatura ({invoice?.items?.length ?? 0})
        </div>

        {loading ? (
          <div className="p-4 text-gray-600">Carregando…</div>
        ) : !invoice || invoice.items.length === 0 ? (
          <div className="p-4 text-gray-600">Nenhum item nessa fatura.</div>
        ) : (
          <div className="divide-y">
            {invoice.items.map((x) => (
              <div key={x.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm text-gray-500">
                      {new Date(x.date).toLocaleDateString("pt-BR")} • {x.statementMonth}
                    </div>
                    <div className="font-medium">
                      {x.description ?? "Compra no cartão"}
                    </div>
                    <div className="text-sm text-gray-500">
                      {x.member ?? "-"} • {x.category ?? "-"} • ({x.installmentNumber}/{x.installmentsTotal})
                    </div>
                  </div>
                  <div className="font-semibold">{formatBRL(x.amountThisInstallment)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="px-4 py-3 text-xs text-gray-500">
          Próximo passo: 1) baixar saldo da conta no pagamento + 2) timeline unificada Conta + Cartão.
        </div>
      </div>
    </div>
  );
}
