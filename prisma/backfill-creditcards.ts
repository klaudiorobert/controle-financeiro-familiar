import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parse(name: string) {
  const raw = String(name ?? "");
  const parts = raw.split("•").map((p) => p.trim());
  const bank = parts?.[0] ?? null;
  const brand = parts?.[1] ?? null;
  const last4 = raw.replace(/\D/g, "").slice(-4) || null;
  return { bank, brand, last4 };
}

async function main() {
  const cards = await prisma.creditCard.findMany({
    select: { id: true, name: true, bank: true, brand: true, last4: true },
  });

  let updated = 0;

  for (const c of cards) {
    // só preenche se estiver faltando
    if (c.bank && c.brand && c.last4) continue;

    const p = parse(c.name);

    if (!p.bank || !p.brand || !p.last4 || p.last4.length !== 4) continue;

    await prisma.creditCard.update({
      where: { id: c.id },
      data: {
        bank: p.bank,
        brand: p.brand,
        last4: p.last4,
      },
    });

    updated++;
  }

  console.log(`Backfill concluído. Cartões atualizados: ${updated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
