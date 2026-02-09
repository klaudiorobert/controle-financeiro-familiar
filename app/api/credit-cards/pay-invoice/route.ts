import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function parseMoney(value: any) {
  const n = parseFloat(String(value));
  return Number.isFinite(n) ? n : NaN;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { creditCardId, statementMonth, paidFromAccountId, amount } = body ?? {};

    if (!creditCardId) return NextResponse.json({ error: "creditCardId é obrigatório." }, { status: 400 });
    if (!statementMonth) return NextResponse.json({ error: "statementMonth é obrigatório (YYYY-MM)." }, { status: 400 });
    if (!paidFromAccountId) return NextResponse.json({ error: "paidFromAccountId é obrigatório." }, { status: 400 });

    const payAmount = parseMoney(amount);
    if (!Number.isFinite(payAmount) || payAmount <= 0) {
      return NextResponse.json({ error: "amount inválido." }, { status: 400 });
    }

    const household = await prisma.household.findFirst({ select: { id: true } });
    if (!household) return NextResponse.json({ error: "Household não encontrado." }, { status: 404 });

    // Total da fatura
    const invAgg = await prisma.cardTransaction.aggregate({
      where: {
        householdId: household.id,
        creditCardId,
        statementMonth,
      },
      _sum: { amountThisInstallment: true },
    });
    const invoiceTotal = Number(invAgg._sum.amountThisInstallment ?? 0);

    if (invoiceTotal <= 0) {
      return NextResponse.json({ error: "Fatura vazia para esse mês." }, { status: 400 });
    }

    // Já pago
    const paidAgg = await prisma.invoicePayment.aggregate({
      where: {
        householdId: household.id,
        creditCardId,
        statementMonth,
      },
      _sum: { amount: true },
    });
    const alreadyPaid = Number(paidAgg._sum.amount ?? 0);

    const remaining = invoiceTotal - alreadyPaid;
    if (payAmount > remaining + 1e-9) {
      return NextResponse.json(
        { error: "Valor maior que o restante da fatura.", details: { invoiceTotal, alreadyPaid, remaining, payAmount } },
        { status: 400 }
      );
    }

    // Registra pagamento (e no futuro a gente pode refletir na conta com um Transaction)
    const payment = await prisma.invoicePayment.create({
      data: {
        householdId: household.id,
        creditCardId,
        statementMonth,
        paidAt: new Date(),
        amount: payAmount as any,
        paidFromAccountId,
      },
    });

    return NextResponse.json({ ok: true, payment, invoiceTotal, alreadyPaid, remainingAfter: remaining - payAmount });
  } catch (err: any) {
    console.error("POST /api/credit-cards/pay-invoice error:", err);
    return NextResponse.json(
      { error: "Erro ao pagar fatura.", message: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
