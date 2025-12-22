const { PrismaClient } = require('../generated/prisma');

async function main() {
  const prisma = new PrismaClient();
  const email = process.argv[2];

  if (!email) {
    console.error('Usage: node scripts/makeAdmin.js <email>');
    process.exit(1);
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error(`User not found for email: ${email}`);
      process.exit(1);
    }

    if (user.role === 'admin') {
      console.log(`User already an admin: ${email}`);
      process.exit(0);
    }

    const updated = await prisma.user.update({
      where: { email },
      data: { role: 'admin' }
    });

    console.log('Success! Promoted user to admin:');
    console.log({ id: updated.id, email: updated.email, role: updated.role });
    process.exit(0);
  } catch (err) {
    console.error('Failed to promote user:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
