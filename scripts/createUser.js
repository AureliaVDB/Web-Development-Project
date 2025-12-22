const bcrypt = require('bcrypt');
const { PrismaClient } = require('../generated/prisma');

async function main() {
  const prisma = new PrismaClient();
  const [email, name, password] = process.argv.slice(2);

  if (!email || !name || !password) {
    console.error('Usage: node scripts/createUser.js <email> <name> <password>');
    process.exit(1);
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log('User already exists:', { id: existing.id, email: existing.email });
      process.exit(0);
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashed,
        emailVerified: true
      },
      select: { id: true, email: true, name: true, emailVerified: true, role: true }
    });

    console.log('User created:', user);
    process.exit(0);
  } catch (err) {
    console.error('Failed to create user:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
