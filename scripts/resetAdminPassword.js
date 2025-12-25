const { PrismaClient } = require('../generated/prisma')
const bcrypt = require('bcrypt')
require('dotenv').config()

const prisma = new PrismaClient()

async function resetAdminPassword() {
  const email = process.env.ADMIN_EMAIL || 'admin@example.com'
  const newPassword = process.env.ADMIN_PASSWORD

  if (!newPassword) {
    console.error('Error: ADMIN_PASSWORD environment variable is not set')
    console.error('Please set ADMIN_PASSWORD in your .env file')
    process.exit(1)
  } 
  
  try {
    // Hash 
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    
    
    const updatedUser = await prisma.user.updateMany({
      where: {
        email: email,
        role: 'admin'
      },
      data: {
        password: hashedPassword
      }
    })
    
    if (updatedUser.count === 0) {
      console.log('No admin user found with that email')
      console.log('Available users:')
      const users = await prisma.user.findMany({
        select: { id: true, email: true, name: true, role: true }
      })
      console.table(users)
    } else {
      console.log('Admin password reset successfully!')
      console.log(`Email: ${email}`)
      console.log(`New password: ${newPassword}`)
    }
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

resetAdminPassword()
