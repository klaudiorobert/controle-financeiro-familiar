import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function monthKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function computeStatementMonth(date: Date, closingDay: number) {
  // Se a compra ocorre após o fechamento, cai na fatura do mês seguinte
  const y = date.getFullYear();
  const m = date.getMonth(); // 0-11
  const d = date.getDate();

  const base = new Date(y, m, 1);
  if (d > closingDay) base.setMonth(base.getMonth() + 1);

  const yy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

export async function POST() {
  try {
    // Assumindo 1 household por enquanto (como vocês estão usando)
    const household = await prisma.household.findFirst({
      select: { id: true },
    });
    if (!household) return NextResponse.json({ error: "Household não encontrado" }, { status: 400 });

    const now = new Date();
    const currentMonth = monthKey(now);

    const subs = await prisma.cardSubscription.findMany({
      where: { householdId: household.id, active: true },
      include: { creditCard: { select: { closingDay: true } } },
    });

    let created = 0;

    for (const s of subs) {
      if (s.lastGeneratedMonth === currentMonth) continue;

      // data de cobrança do mês (dayOfMonth)
      const chargeDate = new Date(now.getFullYear(), now.getMonth(), Math.min(28, Math.max(1, s.dayOfMonth)));

      // não gera antes do startDate
      if (chargeDate < s.startDate) continue;

      const statementMonth = computeStatementMonth(chargeDate, s.creditCard.closingDay);

      await prisma.cardTransaction.create({
        data: {
          householdId: s.householdId,
          creditCardId: s.creditCardId,
          date: chargeDate,
          description: s.description,
          categoryId: s.categoryId,
          memberId: s.memberId,

          totalAmount: s.amount,
          installmentsTotal: 1,
          installmentNumber: 1,

          statementMonth,
          amountThisInstallment: s.amount,
        },
      });

      await prisma.cardSubscription.update({
        where: { id: s.id },
        data: { lastGeneratedMonth: currentMonth },
      });

      created++;
    }

    return NextResponse.json({ ok: true, created, month: currentMonth });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "Erro ao rodar assinaturas" }, { status: 500 });
  }
}
