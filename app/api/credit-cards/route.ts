import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // ✅ agora existe

function badRequest(error: string, details?: any) {
  return NextResponse.json({ error, details }, { status: 400 });
}

function toNumber(v: any) {
  if (v === null || v === undefined) return NaN;
  if (typeof v === "number") return v;
  const s = String(v).trim();
  if (!s) return NaN;
  const normalized = s.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

export async function GET() {
  try {
    const cards = await prisma.creditCard.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(cards);
  } catch (e: any) {
    return NextResponse.json(
      { error: "Falha ao listar cartões.", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const householdId = String(body?.householdId ?? "").trim();
    if (!householdId) return badRequest("householdId é obrigatório.");

    const closingDay = Number(body?.closingDay);
    const dueDay = Number(body?.dueDay);

    if (!Number.isInteger(closingDay) || closingDay < 1 || closingDay > 28) {
      return badRequest("closingDay inválido (use 1 a 28).");
    }
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) {
      return badRequest("dueDay inválido (use 1 a 28).");
    }

    const limit = toNumber(body?.limit);
    if (!Number.isFinite(limit) || limit <= 0) {
      return badRequest("limit inválido (precisa ser > 0).");
    }

    const active = typeof body?.active === "boolean" ? body.active : true;

    const bank = String(body?.bank ?? "").trim();
    const brand = String(body?.brand ?? "").trim();
    const last4 = String(body?.last4 ?? "").trim();
    const nameFromBody = String(body?.name ?? "").trim();

    // aceita name OU monta por bank/brand/last4
    let name = nameFromBody;
    if (!name) {
      if (!bank) return badRequest("Banco é obrigatório.");
      if (!brand) return badRequest("Bandeira é obrigatória.");
      if (!/^\d{4}$/.test(last4)) return badRequest("Final deve ter 4 dígitos.");
      name = `${bank} • ${brand} • ****${last4}`;
    }

    // ✅ create (mínimo compatível com seu schema atual)
    const created = await prisma.creditCard.create({
      data: {
        householdId,
        name,
        limit,
        closingDay,
        dueDay,
        active,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Falha ao salvar cartão.", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
