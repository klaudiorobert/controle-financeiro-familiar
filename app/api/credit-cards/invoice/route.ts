import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function yyyymm(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const creditCardId = url.searchParams.get("creditCardId");
    const statementMonth = url.searchParams.get("statementMonth") || yyyymm(new Date());

    if (!creditCardId) {
      return NextResponse.json({ error: "creditCardId é obrigatório." }, { status: 400 });
    }

    const household = await prisma.household.findFirst({ select: { id: true } });
    if (!household) return NextResponse.json({ error: "Household não encontrado." }, { status: 404 });

    const card = await prisma.creditCard.findUnique({
      where: { id: creditCardId },
      select: { id: true, name: true, closingDay: true, dueDay: true, active: true },
    });
    if (!card) return NextResponse.json({ error: "Cartão não encontrado." }, { status: 404 });

    // Parcelas da fatura (mês)
    const items = await prisma.cardTransaction.findMany({
      where: {
        householdId: household.id,
        creditCardId,
        statementMonth,
      },
      orderBy: [{ date: "asc" }, { installmentNumber: "asc" }],
      include: {
        category: { select: { name: true } },
        member: { select: { name: true } },
      },
    });

    // Total da fatura: soma amountThisInstallment
    const agg = await prisma.cardTransaction.aggregate({
      where: {
        householdId: household.id,
        creditCardId,
        statementMonth,
      },
      _sum: { amountThisInstallment: true },
    });

    const total = Number(agg._sum.amountThisInstallment ?? 0);

    // Pagamentos já feitos para esse mês (se houver)
    const paidAgg = await prisma.invoicePayment.aggregate({
      where: {
        householdId: household.id,
        creditCardId,
        statementMonth,
      },
      _sum: { amount: true },
    });
    const paid = Number(paidAgg._sum.amount ?? 0);

    const remaining = total - paid;

    return NextResponse.json({
      householdId: household.id,
      card,
      statementMonth,
      total,
      paid,
      remaining,
      items: items.map((x) => ({
        id: x.id,
        date: x.date,
        description: x.description,
        category: x.category?.name ?? null,
        member: x.member?.name ?? null,
        totalAmount: Number(x.totalAmount),
        installmentsTotal: x.installmentsTotal,
        installmentNumber: x.installmentNumber,
        amountThisInstallment: Number(x.amountThisInstallment),
        statementMonth: x.statementMonth,
      })),
    });
  } catch (err: any) {
    console.error("GET /api/credit-cards/invoice error:", err);
    return NextResponse.json(
      { error: "Erro ao buscar fatura.", message: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
