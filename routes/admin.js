const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const authenticateToken = require('../middleware/auth');
const requireAdmin = require('../middleware/admin');

const prisma = new PrismaClient();

// All admin routes require authentication + admin role
router.use(authenticateToken);
router.use(requireAdmin);

// Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        _count: {
          select: { bookings: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ count: users.length, users });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users', details: error.message });
  }
});

// Get all bookings
router.get('/bookings', async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        },
        pool: {
          select: {
            id: true,
            name: true,
            city: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ count: bookings.length, bookings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bookings', details: error.message });
  }
});

// Delete any booking
router.delete('/bookings/:id', async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: { select: { name: true, email: true } },
        pool: { select: { name: true } }
      }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    await prisma.booking.delete({
      where: { id: bookingId }
    });

    res.json({ 
      message: 'Booking deleted successfully',
      deleted: {
        id: booking.id,
        user: booking.user.name,
        pool: booking.pool.name,
        date: booking.bookingDate
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete booking', details: error.message });
  }
});

// Get user by ID with all bookings
router.get('/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        bookings: {
          include: {
            pool: {
              select: {
                id: true,
                name: true,
                city: true
              }
            }
          },
          orderBy: { bookingDate: 'desc' }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user', details: error.message });
  }
});

// Delete user (also deletes their bookings via cascade)
router.delete('/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Prevent deleting yourself
    if (userId === req.user.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, _count: { select: { bookings: true } } }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await prisma.user.delete({
      where: { id: userId }
    });

    res.json({ 
      message: 'User deleted successfully',
      deleted: {
        id: userId,
        name: user.name,
        email: user.email,
        bookingsDeleted: user._count.bookings
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user', details: error.message });
  }
});

module.exports = router;
