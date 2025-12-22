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
    const { poolId, bookingDate, startTime } = req.body;

    // Validate required fields
    if (!poolId || !bookingDate || !startTime) {
      return res.status(400).json({ error: 'Missing required fields: poolId, bookingDate, startTime' });
    }

    // Validate date is not in the past
    const bookingDateObj = new Date(bookingDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    bookingDateObj.setHours(0, 0, 0, 0);
    
    if (bookingDateObj < today) {
      return res.status(400).json({ error: 'Cannot book in the past' });
    }

    // Validate time slot (must be one of the hourly slots from 9am to 4pm)
    const validSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
    if (!validSlots.includes(startTime)) {
      return res.status(400).json({ 
        error: 'Invalid time slot. Must be one of: 09:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00, 16:00',
        validSlots 
      });
    }

    // Calculate endTime (1 hour after startTime)
    const [hours] = startTime.split(':');
    const endHour = String(parseInt(hours) + 1).padStart(2, '0');
    const endTime = `${endHour}:00`;

    // Check if pool exists
    const pool = await prisma.pool.findUnique({
      where: { id: poolId }
    });

    if (!pool) {
      return res.status(404).json({ error: 'Pool not found' });
    }

    // Check capacity - count bookings for same pool, date, and time slot
    const existingBookings = await prisma.booking.count({
      where: {
        poolId,
        bookingDate: new Date(bookingDate),
        startTime,
        status: 'confirmed'
      }
    });

    if (existingBookings >= pool.capacity) {
      return res.status(400).json({ error: 'This time slot is fully booked' });
    }

    // Create booking
    const booking = await prisma.booking.create({
      data: {
        userId: req.user.userId,
        poolId,
        bookingDate: new Date(bookingDate),
        startTime,
        endTime,
        duration: 1, // Always 1 hour
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

    // Check if booking is at least 24 hours away
    const bookingDateTime = new Date(booking.bookingDate);
    const [hours, minutes] = booking.startTime.split(':');
    bookingDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    const now = new Date();
    const hoursUntilBooking = (bookingDateTime - now) / (1000 * 60 * 60);
    
    if (hoursUntilBooking < 24) {
      return res.status(400).json({ 
        error: 'Cannot cancel booking less than 24 hours before start time',
        hoursUntilBooking: Math.round(hoursUntilBooking * 10) / 10
      });
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
