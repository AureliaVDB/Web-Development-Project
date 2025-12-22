const { PrismaClient } = require('../generated/prisma');

async function main() {
  const prisma = new PrismaClient();
  const email = process.argv[2];

  if (!email) {
    console.error('Usage: node scripts/verifyEmail.js <email>');
    process.exit(1);
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error(`User not found for email: ${email}`);
      process.exit(1);
    }

    if (user.emailVerified) {
      console.log(`User already verified: ${email}`);
      process.exit(0);
    }

    await prisma.user.update({
      where: { email },
      data: { emailVerified: true, verificationToken: null }
    });

    console.log(`Success! Marked email as verified: ${email}`);
    process.exit(0);
  } catch (err) {
    console.error('Failed to verify email:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
