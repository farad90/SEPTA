const { PrismaClient } = require("./generated/prisma");
const prisma = new PrismaClient();
(async () => {
  const u = await prisma.user.findFirst({ where: { fullName: "حسین نوری" }, select: { email: true } });
  console.log(u.email);
  await prisma.$disconnect();
})();
