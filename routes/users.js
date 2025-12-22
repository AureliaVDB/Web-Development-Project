const express = require('express');
const router = express.Router();
const { PrismaClient } = require('../generated/prisma');
const { authenticateToken } = require('../middleware/auth');
const prisma = new PrismaClient();

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get profile', details: error.message });
  }
});

// Get user dashboard stats
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: req.user.userId },
      include: { pool: true }
    });

    const totalBookings = bookings.length;
    const totalHours = bookings.reduce((sum, booking) => sum + booking.duration, 0);

    res.json({
      totalBookings,
      totalHours,
      recentBookings: bookings.slice(0, 5)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get dashboard', details: error.message });
  }
});

module.exports = router;
