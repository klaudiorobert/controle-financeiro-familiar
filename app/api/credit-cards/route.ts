import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
const prisma = new PrismaClient();

function toNumber(v: any) {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof v === "object" && typeof v.toNumber === "function") return v.toNumber();
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const householdId = url.searchParams.get("householdId");

    // ✅ Se não vier householdId, tenta pegar o primeiro household (compatível com seu bootstrap simples)
    const hid =
      householdId ??
      (await prisma.household.findFirst({ select: { id: true } }))?.id ??
      null;

    if (!hid) return Response.json([], { status: 200 });

    const cards = await prisma.creditCard.findMany({
      where: { householdId: hid },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        householdId: true,
        name: true,
        bank: true,
        brand: true,
        last4: true,
        limit: true,
        closingDay: true,
        dueDay: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return Response.json(cards, { status: 200 });
  } catch (error) {
    console.error("GET /credit-cards ERROR:", error);
    return Response.json(
      { error: "credit_cards_list_failed", details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const householdId = String(body.householdId ?? "").trim();
    if (!householdId) return Response.json({ error: "householdId_required" }, { status: 400 });

    const bank = String(body.bank ?? "").trim();
    const brand = String(body.brand ?? "").trim();
    const last4 = String(body.last4 ?? "").trim();

    const closingDay = Number(body.closingDay);
    const dueDay = Number(body.dueDay);
    const limit = toNumber(body.limit);

    const active = typeof body.active === "boolean" ? body.active : true;

    if (!bank) return Response.json({ error: "bank_required" }, { status: 400 });
    if (!brand) return Response.json({ error: "brand_required" }, { status: 400 });
    if (!/^\d{4}$/.test(last4)) return Response.json({ error: "last4_invalid" }, { status: 400 });

    if (!Number.isFinite(closingDay) || closingDay < 1 || closingDay > 28)
      return Response.json({ error: "closingDay_invalid" }, { status: 400 });
    if (!Number.isFinite(dueDay) || dueDay < 1 || dueDay > 28)
      return Response.json({ error: "dueDay_invalid" }, { status: 400 });

    if (!Number.isFinite(limit) || limit <= 0)
      return Response.json({ error: "limit_invalid" }, { status: 400 });

    const name =
      String(body.name ?? "").trim() || `${bank} • ${brand} • ****${last4}`;

    const created = await prisma.creditCard.create({
      data: {
        householdId,
        name,
        bank,
        brand,
        last4,
        closingDay,
        dueDay,
        limit,
        active,
      },
      select: {
        id: true,
        householdId: true,
        name: true,
        bank: true,
        brand: true,
        last4: true,
        limit: true,
        closingDay: true,
        dueDay: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return Response.json({ creditCard: created }, { status: 201 });
  } catch (error) {
    console.error("POST /credit-cards ERROR:", error);
    return Response.json(
      { error: "credit_card_create_failed", details: String(error) },
      { status: 500 }
    );
  }
}
