import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
const prisma = new PrismaClient();

function toNumber(v: any) {
  if (v == null) return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : undefined;
  }
  if (typeof v === "object" && typeof v.toNumber === "function") return v.toNumber();
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function buildName(bank?: string, brand?: string, last4?: string) {
  const b = String(bank ?? "").trim();
  const br = String(brand ?? "").trim();
  const l4 = String(last4 ?? "").trim();
  if (!b || !br || !/^\d{4}$/.test(l4)) return undefined;
  return `${b} • ${br} • ****${l4}`;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;

    const card = await prisma.creditCard.findUnique({
      where: { id },
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

    if (!card) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    return Response.json({ creditCard: card }, { status: 200 });
  } catch (error) {
    console.error("GET /api/credit-cards/[id] ERROR:", error);
    return Response.json(
      { error: "credit_card_get_failed", details: String(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const body = await req.json();

    const data: any = {};

    if (typeof body.bank === "string") data.bank = body.bank.trim();
    if (typeof body.brand === "string") data.brand = body.brand.trim();
    if (typeof body.last4 === "string") data.last4 = body.last4.trim();

    if (typeof body.closingDay === "number") data.closingDay = body.closingDay;
    if (typeof body.dueDay === "number") data.dueDay = body.dueDay;

    if (typeof body.active === "boolean") data.active = body.active;

    const lim = toNumber(body.limit);
    if (lim !== undefined) data.limit = lim;

    if (typeof body.name === "string" && body.name.trim()) {
      data.name = body.name.trim();
    } else {
      const hasIdentityChange =
        data.bank !== undefined || data.brand !== undefined || data.last4 !== undefined;

      if (hasIdentityChange) {
        const current = await prisma.creditCard.findUnique({
          where: { id },
          select: { bank: true, brand: true, last4: true },
        });

        const newName = buildName(
          data.bank ?? current?.bank,
          data.brand ?? current?.brand,
          data.last4 ?? current?.last4
        );

        if (newName) data.name = newName;
      }
    }

    if (Object.keys(data).length === 0) {
      return Response.json({ error: "nothing_to_update" }, { status: 400 });
    }

    const updated = await prisma.creditCard.update({
      where: { id },
      data,
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

    return Response.json({ creditCard: updated }, { status: 200 });
  } catch (error) {
    console.error("PATCH /api/credit-cards/[id] ERROR:", error);
    return Response.json(
      { error: "credit_card_update_failed", details: String(error) },
      { status: 500 }
    );
  }
}
