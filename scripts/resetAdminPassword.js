const { PrismaClient } = require('../generated/prisma')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()

async function resetAdminPassword() {
  const email = 'poolbookernotifier@gmail.com' // Change this to your admin email
  const newPassword = 'admin123' // Change this to your new password
  
  try {
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    
    // Update the admin user's password
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
      console.log('❌ No admin user found with that email')
      console.log('Available users:')
      const users = await prisma.user.findMany({
        select: { id: true, email: true, name: true, role: true }
      })
      console.table(users)
    } else {
      console.log('✅ Admin password reset successfully!')
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
