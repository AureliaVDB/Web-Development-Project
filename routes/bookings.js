const express = require('express');
const router = express.Router();
const { PrismaClient } = require('../generated/prisma');
const { authenticateToken } = require('../middleware/auth');
const { sendBookingConfirmation, sendCancellationEmail } = require('../utils/email');
const prisma = new PrismaClient();

// Get user's bookings
router.get('/my-bookings', authenticateToken, async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: req.user.userId },
      include: { pool: true },
      orderBy: { bookingDate: 'asc' }
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

    // Check if pool exists
    const pool = await prisma.pool.findUnique({ where: { id: poolId } });
    if (!pool) {
      return res.status(404).json({ error: 'Pool not found' });
    }

    // Validate time slot dynamically based on pool operating hours
    const validSlots = [];
    const [openHour] = pool.openingTime.split(':').map(Number);
    const [closeHour, closeMin] = pool.closingTime.split(':').map(Number);
    let h = openHour;
    while (h < closeHour || (h === closeHour && closeMin > 0)) {
      validSlots.push(`${String(h).padStart(2, '0')}:00`);
      h++;
    }
    if (!validSlots.includes(startTime)) {
      return res.status(400).json({ 
        error: 'Invalid time slot for this pool.',
        validSlots
      });
    }

    // Calculate endTime (1 hour after startTime)
    const [hours] = startTime.split(':');
    const endHour = String(parseInt(hours) + 1).padStart(2, '0');
    const endTime = `${endHour}:00`;

    // Check capacity - count bookings for same pool, date, and time slot
    const existingBookings = await prisma.booking.count({
      where: {
        poolId,
        bookingDate: bookingDateObj,
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
        bookingDate: bookingDateObj,
        startTime,
        endTime,
        duration: 1,
        totalPrice: 0,
        status: 'confirmed'
      },
      include: { pool: true, user: true }
    });

    // Send confirmation email (don't wait for it)
    sendBookingConfirmation(
      booking.user.email,
      booking.user.name,
      booking,
      booking.pool
    ).catch(err => console.error('Email error:', err));

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
      where: { id: bookingId },
      include: { pool: true, user: true }
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

    // Send cancellation email before deleting
    sendCancellationEmail(
      booking.user.email,
      booking.user.name,
      booking,
      booking.pool
    ).catch(err => console.error('Email error:', err));

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
