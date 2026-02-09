import { PrismaClient, MemberType, TransactionType, RoleInHousehold } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Evita criar duplicado: procura Household padrão
  const existing = await prisma.household.findFirst({
    where: { name: "Família do Cláudio" },
  });

  if (existing) {
    console.log("Seed já aplicado: Household encontrado:", existing.id);
    return;
  }

  // 1) Criar usuário dono (admin)
  const owner = await prisma.user.upsert({
    where: { email: "claudio@local" },
    update: {},
    create: { email: "claudio@local", name: "Cláudio" },
  });

  // 2) Criar Household com branding
  const household = await prisma.household.create({
    data: {
      name: "Gande Família",
      currency: "BRL",
      appName: "Finanças da Família",
      theme: {
        primaryColor: "#16a34a",
        secondaryColor: "#0ea5e9",
        mode: "light",
      },
      users: {
        create: [{ userId: owner.id, role: RoleInHousehold.OWNER }],
      },
    },
  });

  // 3) Criar membros (Pai/Mãe/Filho)
  const [pai, mae, filho] = await Promise.all([
    prisma.householdMember.create({
      data: { householdId: household.id, name: "Pai", type: MemberType.PAI },
    }),
    prisma.householdMember.create({
      data: { householdId: household.id, name: "Mãe", type: MemberType.MAE },
    }),
    prisma.householdMember.create({
      data: { householdId: household.id, name: "Filho", type: MemberType.FILHO },
    }),
  ]);

  // 4) Categorias padrão (com algumas subcategorias)
  const catMoradia = await prisma.category.create({
    data: { householdId: household.id, name: "Moradia" },
  });
  const catAlimentacao = await prisma.category.create({
    data: { householdId: household.id, name: "Alimentação" },
  });
  const catTransporte = await prisma.category.create({
    data: { householdId: household.id, name: "Transporte" },
  });
  const catSaude = await prisma.category.create({
    data: { householdId: household.id, name: "Saúde" },
  });
  const catLazer = await prisma.category.create({
    data: { householdId: household.id, name: "Lazer" },
  });
  const catEducacao = await prisma.category.create({
    data: { householdId: household.id, name: "Educação" },
  });
  const catRenda = await prisma.category.create({
    data: { householdId: household.id, name: "Renda" },
  });

  await prisma.category.createMany({
    data: [
      { householdId: household.id, name: "Aluguel/Financiamento", parentId: catMoradia.id },
      { householdId: household.id, name: "Condomínio", parentId: catMoradia.id },
      { householdId: household.id, name: "Energia/Água", parentId: catMoradia.id },

      { householdId: household.id, name: "Supermercado", parentId: catAlimentacao.id },
      { householdId: household.id, name: "Restaurante", parentId: catAlimentacao.id },

      { householdId: household.id, name: "Combustível", parentId: catTransporte.id },
      { householdId: household.id, name: "Manutenção", parentId: catTransporte.id },

      { householdId: household.id, name: "Farmácia", parentId: catSaude.id },

      { householdId: household.id, name: "Passeios", parentId: catLazer.id },

      { householdId: household.id, name: "Escola/Curso", parentId: catEducacao.id },

      { householdId: household.id, name: "Salário", parentId: catRenda.id },
      { householdId: household.id, name: "Extra", parentId: catRenda.id },
    ],
  });

  // 5) Contas iniciais
  const contaCarteira = await prisma.account.create({
    data: {
      householdId: household.id,
      name: "Carteira",
      type: "CASH",
      initialBalance: 0,
    },
  });

  const contaBanco = await prisma.account.create({
    data: {
      householdId: household.id,
      name: "Banco",
      type: "BANK",
      initialBalance: 0,
    },
  });

  // 6) Exemplo de lançamento (só pra validar)
  await prisma.transaction.create({
    data: {
      householdId: household.id,
      date: new Date(),
      type: TransactionType.EXPENSE,
      amount: 12.5,
      description: "Café (exemplo seed)",
      categoryId: catAlimentacao.id,
      accountFromId: contaCarteira.id,
      memberId: pai.id,
      createdByUserId: owner.id,
    },
  });

  console.log("✅ Seed aplicado com sucesso!");
  console.log("Household:", household.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
