const express = require('express');
const router = express.Router();
const { PrismaClient } = require('../generated/prisma');
const { authenticateToken } = require('../middleware/auth');
const prisma = new PrismaClient();

// Get user's bookings
router.get('/my-bookings', authenticateToken, async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: req.user.userId },
      include: { pool: true },
      orderBy: { bookingDate: 'desc' }
    });

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get bookings', details: error.message });
  }
});

// Create booking
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { poolId, bookingDate, startTime, endTime, duration } = req.body;

    // Check if pool exists
    const pool = await prisma.pool.findUnique({
      where: { id: poolId }
    });

    if (!pool) {
      return res.status(404).json({ error: 'Pool not found' });
    }

    // Check capacity - count bookings for same pool, date, and overlapping time
    const existingBookings = await prisma.booking.count({
      where: {
        poolId,
        bookingDate: new Date(bookingDate),
        status: 'confirmed'
      }
    });

    if (existingBookings >= pool.capacity) {
      return res.status(400).json({ error: 'Pool capacity reached for this date' });
    }

    // Create booking
    const booking = await prisma.booking.create({
      data: {
        userId: req.user.userId,
        poolId,
        bookingDate: new Date(bookingDate),
        startTime,
        endTime,
        duration,
        totalPrice: 0,
        status: 'confirmed'
      },
      include: { pool: true }
    });

    res.status(201).json(booking);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create booking', details: error.message });
  }
});

// Delete booking
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);

    // Check if booking exists and belongs to user
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.userId !== req.user.userId) {
      return res.status(403).json({ error: 'You can only delete your own bookings' });
    }

    // Delete booking
    await prisma.booking.delete({
      where: { id: bookingId }
    });

    res.json({ message: 'Booking deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete booking', details: error.message });
  }
});

module.exports = router;
