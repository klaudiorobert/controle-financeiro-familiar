"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Brand = "Visa" | "Mastercard" | "Elo" | "Amex" | "Hipercard" | "Other";
type CardStatus = "ACTIVE" | "INACTIVE";

function brlToNumber(v: string) {
  const cleaned = String(v ?? "").replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}
function clampDay(v: number) {
  if (!Number.isFinite(v)) return 1;
  return Math.min(28, Math.max(1, Math.floor(v)));
}

function normalizeBrand(v: any): Brand {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "visa") return "Visa";
  if (s === "master" || s === "mastercard") return "Mastercard";
  if (s === "elo") return "Elo";
  if (s === "amex" || s === "american express") return "Amex";
  if (s === "hipercard") return "Hipercard";
  return "Other";
}

function parseCardName(name: string) {
  const raw = String(name ?? "");
  const parts = raw.split("•").map((p) => p.trim());
  const bank = parts?.[0] ?? "";
  const brand = parts?.[1] ?? "";
  const last4 = raw.replace(/\D/g, "").slice(-4);
  return { bank, brand, last4 };
}

export default function EditarCartaoPage({ params }: { params: { id: string } }) {
  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [householdId, setHouseholdId] = useState("");

  const [bank, setBank] = useState("");
  const [brand, setBrand] = useState<Brand>("Visa");
  const [last4, setLast4] = useState("");
  const [closingDay, setClosingDay] = useState(5);
  const [dueDay, setDueDay] = useState(10);
  const [limit, setLimit] = useState("0,00");
  const [status, setStatus] = useState<CardStatus>("ACTIVE");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/credit-cards/${id}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          alert(`Erro ao carregar cartão: ${json?.error ?? "desconhecido"}`);
          window.location.href = "/cartoes";
          return;
        }

        const c = json?.creditCard ?? json;

        setHouseholdId(String(c?.householdId ?? ""));

        const fallback = parseCardName(String(c?.name ?? ""));
        setBank(String(c?.bank ?? fallback.bank ?? ""));
        setBrand(normalizeBrand(c?.brand ?? fallback.brand));
        setLast4(String(c?.last4 ?? fallback.last4 ?? "").slice(-4));

        setClosingDay(Number(c?.closingDay ?? 5));
        setDueDay(Number(c?.dueDay ?? 10));

        const lim = Number(String(c?.limit ?? "0").replace(",", "."));
        setLimit((Number.isFinite(lim) ? lim : 0).toFixed(2).replace(".", ","));

        setStatus(c?.active ? "ACTIVE" : "INACTIVE");
      } catch (e) {
        alert("Falha ao carregar cartão.");
        window.location.href = "/cartoes";
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  function validate(): string | null {
    if (!householdId) return "Household não carregou.";
    if (!bank.trim()) return "Informe o banco.";
    if (!brand) return "Selecione a bandeira.";
    if (!/^\d{4}$/.test(last4.trim())) return "Informe os 4 últimos dígitos.";
    const lim = brlToNumber(limit);
    if (!Number.isFinite(lim) || lim <= 0) return "Informe um limite válido.";
    if (!closingDay) return "Informe o dia de fechamento.";
    if (!dueDay) return "Informe o dia de vencimento.";
    return null;
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
        name: `${bankClean} • ${brand} • ****${last4Clean}`,
        closingDay: clampDay(closingDay),
        dueDay: clampDay(dueDay),
        limit: brlToNumber(limit),
        active: status === "ACTIVE",
      };

      const res = await fetch(`/api/credit-cards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`Erro ao salvar alterações: ${json?.error ?? "desconhecido"}`);
        return;
      }

      window.location.href = "/cartoes";
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-72px)] bg-gray-50">
      <div className="max-w-3xl mx-auto p-5 md:p-6">
        <div className="flex items-end justify-between gap-3 mb-5">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Editar cartão</h1>
            <p className="text-sm text-gray-600">Alterações em página separada</p>
          </div>

          <Link href="/cartoes" className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50">
            Voltar
          </Link>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          {loading ? (
            <div className="text-gray-600">Carregando…</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-4">
                <label className="text-xs text-gray-600">Banco</label>
                <input
                  className="w-full border rounded-xl px-3 py-2"
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
                  <option value="Mastercard">Mastercard</option>
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
                  disabled={saving}
                />
              </div>

              <div className="md:col-span-3">
                <label className="text-xs text-gray-600">Status</label>
                <select
                  className="w-full border rounded-xl px-3 py-2"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  disabled={saving}
                >
                  <option value="ACTIVE">Ativo</option>
                  <option value="INACTIVE">Inativo</option>
                </select>
              </div>

              <div className="md:col-span-12 flex flex-wrap gap-2 mt-2">
                <button
                  onClick={onSave}
                  disabled={saving}
                  className="px-5 py-3 rounded-xl bg-black text-white hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Salvando…" : "Salvar alterações"}
                </button>

                <Link
                  href="/cartoes"
                  className="px-5 py-3 rounded-xl border bg-white hover:bg-gray-50"
                >
                  Cancelar
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
