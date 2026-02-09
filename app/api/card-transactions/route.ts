import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * Helpers
 */
function parseMoney(value: any) {
  const n = parseFloat(String(value));
  return Number.isFinite(n) ? n : NaN;
}

function toNumberDecimal(v: any) {
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function yyyymm(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function addMonths(d: Date, months: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
}

/**
 * Fatura (statementMonth) baseado em closingDay:
 * - Se dia da compra <= closingDay => entra na fatura do MES ATUAL
 * - Se dia da compra > closingDay  => entra na fatura do MES SEGUINTE
 */
function statementMonthForPurchase(purchaseDate: Date, closingDay: number) {
  const day = purchaseDate.getDate();
  const baseMonth =
    day <= closingDay ? purchaseDate : addMonths(purchaseDate, 1);
  return yyyymm(baseMonth);
}

/**
 * Divide parcelas sem erro de centavos:
 * total em centavos, reparte base e joga resto no último item
 */
function splitInstallments(total: number, n: number) {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  const rest = cents - base * n;

  const parts = Array(n).fill(base);
  parts[n - 1] = base + rest;

  return parts.map((c: number) => c / 100);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      // Obrigatórios
      creditCardId,
      date, // "2026-02-05" ou ISO
      totalAmount,
      installmentsTotal = 1,

      // Opcionais
      description,
      categoryId,
      memberId,
    } = body ?? {};

    // 1) Validações básicas
    if (!creditCardId) {
      return NextResponse.json(
        { error: "creditCardId é obrigatório." },
        { status: 400 },
      );
    }
    if (!date) {
      return NextResponse.json(
        { error: "date é obrigatório." },
        { status: 400 },
      );
    }

    const purchaseDate = new Date(date);
    if (Number.isNaN(purchaseDate.getTime())) {
      return NextResponse.json({ error: "date inválido." }, { status: 400 });
    }

    const total = parseMoney(totalAmount);
    if (!Number.isFinite(total) || total <= 0) {
      return NextResponse.json(
        { error: "totalAmount inválido." },
        { status: 400 },
      );
    }

    const n = Math.max(1, Math.min(24, Number(installmentsTotal)));
    if (!Number.isFinite(n) || n < 1 || n > 24) {
      return NextResponse.json(
        { error: "installmentsTotal inválido (1 a 24)." },
        { status: 400 },
      );
    }

    // 2) Carrega cartão (precisa de closingDay/dueDay/limit/active/householdId)
    const card = await prisma.creditCard.findUnique({
      where: { id: creditCardId },
      select: {
        id: true,
        householdId: true,
        active: true,
        limit: true,
        closingDay: true,
        dueDay: true,
        name: true,
      },
    });

    if (!card) {
      return NextResponse.json(
        { error: "Cartão não encontrado." },
        { status: 404 },
      );
    }
    if (!card.active) {
      return NextResponse.json(
        { error: "Cartão inativo/bloqueado. Não é possível lançar compras." },
        { status: 400 },
      );
    }

    const closingDay = Number(card.closingDay);
    if (!Number.isFinite(closingDay) || closingDay < 1 || closingDay > 31) {
      return NextResponse.json(
        { error: "Cartão com closingDay inválido. Corrija no cadastro." },
        { status: 400 },
      );
    }

    const limitTotal = toNumberDecimal(card.limit);
    if (!Number.isFinite(limitTotal) || limitTotal <= 0) {
      return NextResponse.json(
        { error: "Cartão sem limite válido. Corrija no cadastro." },
        { status: 400 },
      );
    }

    // 3) Calcula limite usado (por enquanto: soma de todas parcelas em aberto)
    const usedAgg = await prisma.cardTransaction.aggregate({
      where: {
        householdId: card.householdId,
        creditCardId: card.id,
      },
      _sum: { amountThisInstallment: true },
    });

    const limitUsed = toNumberDecimal(usedAgg._sum.amountThisInstallment);
    const limitAvailable = limitTotal - limitUsed;

    // Regra: cartão consome o TOTAL da compra no momento da compra
    if (total > limitAvailable + 1e-9) {
      return NextResponse.json(
        {
          error: "Limite insuficiente no cartão.",
          details: {
            card: card.name,
            limitTotal,
            limitUsed,
            limitAvailable,
            requested: total,
          },
        },
        { status: 400 },
      );
    }

    // 4) Define statementMonth da 1ª parcela, e gera parcelas
    const firstStatementMonth = statementMonthForPurchase(
      purchaseDate,
      closingDay,
    );
    const parts = splitInstallments(total, n);

    // Exemplo:
    // Compra dia 10, closingDay 05 => 1ª parcela entra no próximo mês
    // Parcelas seguintes: +1 mês, +2 meses, ...
    const rows = parts.map((amountThisInstallment, idx) => {
      const installmentNumber = idx + 1;
      const statementMonth = yyyymm(
        addMonths(new Date(firstStatementMonth + "-01T00:00:00"), idx),
      );

      return {
        householdId: card.householdId,
        creditCardId: card.id,
        date: purchaseDate,
        description: description ?? null,
        categoryId: categoryId ?? null,
        memberId: memberId ?? null,

        totalAmount: total as any,
        installmentsTotal: n,
        installmentNumber,

        statementMonth,
        amountThisInstallment: amountThisInstallment as any,
      };
    });

    // 5) Insere tudo de uma vez
    await prisma.cardTransaction.createMany({ data: rows });

    return NextResponse.json({
      ok: true,
      creditCardId: card.id,
      purchaseDate: purchaseDate.toISOString(),
      firstStatementMonth,
      installmentsCreated: n,
      limit: {
        total: limitTotal,
        usedBefore: limitUsed,
        availableBefore: limitAvailable,
        requested: total,
        availableAfter: limitAvailable - total,
      },
    });
  } catch (err: any) {
    console.error("POST /api/card-transactions error:", err);
    return NextResponse.json(
      {
        error: "Erro ao lançar compra no cartão.",
        message: err?.message ?? String(err),
      },
      { status: 500 },
    );
  }
}
