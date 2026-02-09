import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
const prisma = new PrismaClient();

function toNumber(v: any) {
  if (v == null) return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  if (typeof v === "object" && typeof v.toNumber === "function") return v.toNumber();
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
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

    // Atualiza name automaticamente se banco/bandeira/last4 mudarem, a não ser que name seja enviado
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

        const bank = (data.bank ?? current?.bank ?? "").trim();
        const brand = (data.brand ?? current?.brand ?? "").trim();
        const last4 = (data.last4 ?? current?.last4 ?? "").trim();

        if (bank && brand && /^\d{4}$/.test(last4)) {
          data.name = `${bank} • ${brand} • ****${last4}`;
        }
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
        closingDay: true,
        dueDay: true,
        limit: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return Response.json({ creditCard: updated }, { status: 200 });
  } catch (error) {
    console.error("PATCH CREDIT-CARD ERROR:", error);
    return Response.json(
      { error: "credit_card_update_failed", details: String(error) },
      { status: 500 }
    );
  }
}
