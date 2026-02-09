import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function toNumber(v: any) {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(String(v));
  return Number.isFinite(n) ? n : 0;
}

export async function GET() {
  try {
    const household = await prisma.household.findFirst({ select: { id: true } });
    if (!household) return NextResponse.json([], { status: 200 });

    const subs = await prisma.cardSubscription.findMany({
      where: { householdId: household.id },
      orderBy: [{ active: "desc" }, { description: "asc" }],
      include: {
        creditCard: { select: { id: true, name: true, closingDay: true, dueDay: true } },
        category: { select: { id: true, name: true } },
        member: { select: { id: true, name: true, type: true } },
      },
    });

    return NextResponse.json(
      subs.map((s) => ({
        ...s,
        amount: toNumber(s.amount),
      }))
    );
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "Erro ao listar" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const householdId = String(body.householdId || "");
    const creditCardId = String(body.creditCardId || "");
    const description = String(body.description || "").trim();
    const amount = toNumber(body.amount);
    const dayOfMonth = Number(body.dayOfMonth);
    const startDate = String(body.startDate || "");
    const categoryId = body.categoryId ? String(body.categoryId) : null;
    const memberId = body.memberId ? String(body.memberId) : null;

    if (!householdId) return NextResponse.json({ error: "householdId obrigatório" }, { status: 400 });
    if (!creditCardId) return NextResponse.json({ error: "creditCardId obrigatório" }, { status: 400 });
    if (!description) return NextResponse.json({ error: "description obrigatório" }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "amount inválido" }, { status: 400 });
    if (!Number.isFinite(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) {
      return NextResponse.json({ error: "dayOfMonth deve ser 1..28" }, { status: 400 });
    }
    if (!startDate) return NextResponse.json({ error: "startDate obrigatório" }, { status: 400 });

    const created = await prisma.cardSubscription.create({
      data: {
        householdId,
        creditCardId,
        description,
        amount,
        dayOfMonth,
        startDate: new Date(startDate),
        categoryId,
        memberId,
        active: true,
      },
    });

    return NextResponse.json({ ok: true, id: created.id });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "Erro ao criar" }, { status: 500 });
  }
}
