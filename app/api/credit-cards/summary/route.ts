import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";

const prisma = new PrismaClient();

function toNumber(v: any) {
  if (v == null) return 0;
  // Prisma Decimal pode vir como objeto/string
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v) || 0;
  if (typeof v === "object" && typeof v.toNumber === "function") return v.toNumber();
  return Number(v) || 0;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const householdId = url.searchParams.get("householdId");

    if (!householdId) {
      return Response.json({ error: "householdId_required" }, { status: 400 });
    }

    // 1) Buscar todos os cartões
    const cards = await prisma.creditCard.findMany({
      where: { householdId, active: true },
      select: {
        id: true,
        name: true,
        limit: true,
        closingDay: true,
        dueDay: true,
      },
      orderBy: { createdAt: "desc" }, // agora existe
    });

    // 2) Somar limite total
    const totalLimit = cards.reduce((acc, c) => acc + toNumber(c.limit), 0);

    // 3) Calcular "limite usado" (regra simples: soma parcelas em aberto)
    // Aqui usamos CardTransaction.amountThisInstallment por ser o valor da parcela do mês
    const cardTx = await prisma.cardTransaction.findMany({
      where: { householdId, active: true },
      select: {
        amountThisInstallment: true,
      },
    });

    const usedLimit = cardTx.reduce((acc, t) => acc + toNumber(t.amountThisInstallment), 0);

    return Response.json(
      {
        totalLimit,
        usedLimit,
        availableLimit: Math.max(0, totalLimit - usedLimit),
        cardsCount: cards.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("CREDIT-CARDS SUMMARY ERROR:", error);
    return Response.json(
      { error: "summary_failed", details: String(error) },
      { status: 500 }
    );
  }
}