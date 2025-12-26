const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { PrismaClient } = require('../generated/prisma');
const { authenticateToken } = require('../middleware/auth');
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

// Get user by ID 
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

// Create user
router.post('/users', async (req, res) => {
  try {
    const { email, name, password, role } = req.body;

    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Missing required fields: email, name, password' });
    }

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role: role || 'user',
        emailVerified: true // auto verified
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    });

    res.status(201).json({ message: 'User created successfully', user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user', details: error.message });
  }
});

// Update user
router.put('/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { name, email, role } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check email uniqueness 
    if (email && email !== user.email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(400).json({ error: 'Email already in use' });
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(role && { role })
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    });

    res.json({ message: 'User updated successfully', user: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user', details: error.message });
  }
});

// Delete user plus the rest
router.delete('/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // no deleting of admin
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

// Create booking
router.post('/bookings', async (req, res) => {
  try {
    const { userId, poolId, bookingDate, startTime } = req.body;

    if (!userId || !poolId || !bookingDate || !startTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const pool = await prisma.pool.findUnique({ where: { id: poolId } });
    if (!pool) {
      return res.status(404).json({ error: 'Pool not found' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    //Calculate endtime
    const [hours] = startTime.split(':');
    const endTime = `${String(parseInt(hours) + 1).padStart(2, '0')}:00`;

    const booking = await prisma.booking.create({
      data: {
        userId,
        poolId,
        bookingDate: new Date(bookingDate),
        startTime,
        endTime,
        duration: 1,
        totalPrice: 0,
        status: 'confirmed'
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        pool: { select: { id: true, name: true, city: true } }
      }
    });

    res.status(201).json({ message: 'Booking created successfully', booking });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create booking', details: error.message });
  }
});

// Update booking
router.put('/bookings/:id', async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const { bookingDate, startTime, status } = req.body;

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    let endTime = booking.endTime;
    if (startTime) {
      const [hours] = startTime.split(':');
      endTime = `${String(parseInt(hours) + 1).padStart(2, '0')}:00`;
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        ...(bookingDate && { bookingDate: new Date(bookingDate) }),
        ...(startTime && { startTime, endTime }),
        ...(status && { status })
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        pool: { select: { id: true, name: true, city: true } }
      }
    });

    res.json({ message: 'Booking updated successfully', booking: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update booking', details: error.message });
  }
});

// Create pool
router.post('/pools', async (req, res) => {
  try {
    const { id, name, address, city, latitude, longitude, poolType, isIndoor, capacity, openingTime, closingTime, facilities, imageUrl } = req.body;

    if (!id || !name || !address || !city || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Missing required fields: id, name, address, city, latitude, longitude' });
    }

    // Check if pool id exists
    const existing = await prisma.pool.findUnique({ where: { id } });
    if (existing) {
      return res.status(400).json({ error: 'Pool ID already exists' });
    }

    const pool = await prisma.pool.create({
      data: {
        id,
        name,
        address,
        city,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        poolType: poolType || 'recreational',
        isIndoor: isIndoor !== false,
        capacity: capacity ? parseInt(capacity) : 20,
        openingTime: openingTime || '08:00',
        closingTime: closingTime || '20:00',
        facilities: facilities || null,
        imageUrl: imageUrl || null
      }
    });

    res.status(201).json({ message: 'Pool created successfully', pool });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create pool', details: error.message });
  }
});

// Update pool
router.put('/pools/:id', async (req, res) => {
  try {
    const poolId = req.params.id;
    const { name, address, city, latitude, longitude, poolType, isIndoor, capacity, openingTime, closingTime, facilities, imageUrl } = req.body;

    const pool = await prisma.pool.findUnique({ where: { id: poolId } });
    if (!pool) {
      return res.status(404).json({ error: 'Pool not found' });
    }

    const updated = await prisma.pool.update({
      where: { id: poolId },
      data: {
        ...(name && { name }),
        ...(address && { address }),
        ...(city && { city }),
        ...(latitude !== undefined && { latitude: parseFloat(latitude) }),
        ...(longitude !== undefined && { longitude: parseFloat(longitude) }),
        ...(poolType && { poolType }),
        ...(isIndoor !== undefined && { isIndoor }),
        ...(capacity && { capacity: parseInt(capacity) }),
        ...(openingTime && { openingTime }),
        ...(closingTime && { closingTime }),
        ...(facilities !== undefined && { facilities }),
        ...(imageUrl !== undefined && { imageUrl })
      }
    });

    res.json({ message: 'Pool updated successfully', pool: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update pool', details: error.message });
  }
});

//Delete pool
router.delete('/pools/:id', async (req, res) => {
  try {
    const poolId = req.params.id;

    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      select: { name: true, _count: { select: { bookings: true } } }
    });

    if (!pool) {
      return res.status(404).json({ error: 'Pool not found' });
    }

    //Check if pool has bookings
    if (pool._count.bookings > 0) {
      return res.status(400).json({ 
        error: `Cannot delete pool with ${pool._count.bookings} existing booking(s). Delete bookings first.`
      });
    }

    await prisma.pool.delete({
      where: { id: poolId }
    });

    res.json({ 
      message: 'Pool deleted successfully',
      deleted: {
        id: poolId,
        name: pool.name
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete pool', details: error.message });
  }
});

module.exports = router;
