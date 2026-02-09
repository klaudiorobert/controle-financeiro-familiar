import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const transactions = await prisma.transaction.findMany({
    orderBy: { date: "desc" },
    include: {
      category: true,
      member: true,
      accountFrom: true,
    },
  });

  return NextResponse.json(transactions);
}

export async function POST(req: Request) {
  const body = await req.json();

  // fallback (sem auth): pega o primeiro household e primeiro user
  const hh =
    body.householdId
      ? await prisma.household.findUnique({ where: { id: body.householdId } })
      : await prisma.household.findFirst();

  if (!hh) {
    return NextResponse.json({ error: "Household não encontrado." }, { status: 400 });
  }

  const hhUser =
    body.createdByUserId
      ? { id: body.createdByUserId }
      : await (async () => {
          const link = await prisma.householdUser.findFirst({
            where: { householdId: hh.id },
            select: { userId: true },
          });
          return link ? { id: link.userId } : null;
        })();

  if (!hhUser) {
    return NextResponse.json({ error: "Usuário criador não encontrado." }, { status: 400 });
  }

  const transaction = await prisma.transaction.create({
    data: {
      householdId: hh.id,
      date: new Date(body.date),
      type: body.type,
      amount: body.amount,
      description: body.description,
      categoryId: body.categoryId,
      accountFromId: body.accountFromId,
      memberId: body.memberId,
      createdByUserId: hhUser.id,
    },
  });

  return NextResponse.json(transaction);
}

