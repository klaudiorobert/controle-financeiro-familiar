import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";

const prisma = new PrismaClient();

export async function GET() {
  try {
    // 🔎 tenta pegar qualquer household existente
    const household = await prisma.household.findFirst();

    // se não existir ainda
    if (!household) {
      return Response.json(
        { needsHousehold: true },
        { status: 200 }
      );
    }

    return Response.json(
      { household },
      { status: 200 }
    );
  } catch (error) {
    console.error("BOOTSTRAP ERROR:", error);

    return Response.json(
      { error: "bootstrap_failed", details: String(error) },
      { status: 500 }
    );
  }
}

