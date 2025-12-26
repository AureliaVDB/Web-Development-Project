const express = require('express');
const router = express.Router();
const { PrismaClient } = require('../generated/prisma');
const { calculateDistance } = require('../utils/distance');
const { authenticateToken } = require('../middleware/auth');
const prisma = new PrismaClient();

// Get all swimming pools from database
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search, type, city, x, y, radius } = req.query;

    // build filter conditions
    const where = {};

    if (search) {
      where.name = {
        contains: search
      };
    }

    if (type === 'indoor') {
      where.isIndoor = true;
    } else if (type === 'outdoor') {
      where.isIndoor = false;
    }

    if (city) {
      where.city = {
        contains: city
      };
    }

    // fetch pools from database
    let pools = await prisma.pool.findMany({
      where,
      select: {
        id: true,
        name: true,
        isIndoor: true,
        address: true,
        city: true,
        latitude: true,
        longitude: true,
        capacity: true,
        openingTime: true,
        closingTime: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    // get user's favorites
    const userFavorites = await prisma.userFavorite.findMany({
      where: { userId: req.user.userId },
      select: { poolId: true }
    });
    const favoriteIds = new Set(userFavorites.map(f => f.poolId));

    // filter by distance if coordinates provided
    if (x && y) {
      const userX = parseFloat(x);
      const userY = parseFloat(y);
      const maxRadius = radius ? parseFloat(radius) : null;

      // calculate distance for each pool
      pools = pools.map(pool => ({
        ...pool,
        distance: calculateDistance(userX, userY, pool.longitude, pool.latitude),
        isFavorited: favoriteIds.has(pool.id)
      }));

      // filter by radius if specified
      if (maxRadius) {
        pools = pools.filter(pool => pool.distance <= maxRadius);
      }

      // sort by distance
      pools.sort((a, b) => a.distance - b.distance);
    } else {
      // add isFavorited flag
      pools = pools.map(pool => ({
        ...pool,
        isFavorited: favoriteIds.has(pool.id)
      }));
    }

    res.json({
      count: pools.length,
      filters: { search, type, city, x, y, radius },
      pools
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch pools', details: error.message });
  }
});

// Get single pool by ID (must be before debug routes)
router.get('/:id', async (req, res) => {
  try {
    const pool = await prisma.pool.findUnique({
      where: { id: req.params.id }
    });

    if (!pool) {
      return res.status(404).json({ error: 'Pool not found' });
    }

    res.json(pool);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pool', details: error.message });
  }
});

// Check availability for a pool on a specific date or date range
router.get('/:id/availability', async (req, res) => {
  try {
    const { date, startDate, endDate } = req.query;

    // Single date mode
    if (date) {
      return handleSingleDateAvailability(req, res, date);
    }

    // Date range mode
    if (startDate && endDate) {
      return handleDateRangeAvailability(req, res, startDate, endDate);
    }

    return res.status(400).json({ 
      error: 'Either date parameter or both startDate and endDate parameters required (format: YYYY-MM-DD)' 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check availability', details: error.message });
  }
});

async function handleSingleDateAvailability(req, res, date) {
  const pool = await prisma.pool.findUnique({
    where: { id: req.params.id }
  });

  if (!pool) {
    return res.status(404).json({ error: 'Pool not found' });
  }

  // All possible time slots
  const timeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];

  // Get bookings for this pool on this date
  const bookings = await prisma.booking.findMany({
    where: {
      poolId: req.params.id,
      bookingDate: new Date(date),
      status: 'confirmed'
    }
  });

  // Count bookings per time slot
  const availability = timeSlots.map(slot => {
    const bookingsAtSlot = bookings.filter(b => b.startTime === slot).length;
    const available = pool.capacity - bookingsAtSlot;
    
    return {
      startTime: slot,
      endTime: `${String(parseInt(slot.split(':')[0]) + 1).padStart(2, '0')}:00`,
      capacity: pool.capacity,
      booked: bookingsAtSlot,
      available,
      isAvailable: available > 0
    };
  });

  res.json({
    poolId: pool.id,
    poolName: pool.name,
    date,
    openingTime: pool.openingTime,
    closingTime: pool.closingTime,
    slots: availability
  });
}

async function handleDateRangeAvailability(req, res, startDate, endDate) {
  const pool = await prisma.pool.findUnique({
    where: { id: req.params.id }
  });

  if (!pool) {
    return res.status(404).json({ error: 'Pool not found' });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Get all bookings in the date range
  const bookings = await prisma.booking.findMany({
    where: {
      poolId: req.params.id,
      bookingDate: {
        gte: start,
        lte: end
      },
      status: 'confirmed'
    }
  });

  // Group bookings by date
  const bookingsByDate = {};
  bookings.forEach(b => {
    const dateKey = b.bookingDate.toISOString().split('T')[0];
    if (!bookingsByDate[dateKey]) {
      bookingsByDate[dateKey] = [];
    }
    bookingsByDate[dateKey].push(b);
  });

  // Calculate availability for each date
  const dates = [];
  const current = new Date(start);
  
  while (current <= end) {
    const dateKey = current.toISOString().split('T')[0];
    const dayBookings = bookingsByDate[dateKey] || [];
    
    // All possible time slots
    const timeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
    
    // Count how many slots have availability
    let availableSlots = 0;
    let totalSlots = timeSlots.length;
    
    timeSlots.forEach(slot => {
      const bookingsAtSlot = dayBookings.filter(b => b.startTime === slot).length;
      const available = pool.capacity - bookingsAtSlot;
      if (available > 0) {
        availableSlots++;
      }
    });
    
    dates.push({
      date: dateKey,
      hasAvailableSlots: availableSlots > 0,
      availableSlots,
      totalSlots
    });
    
    current.setDate(current.getDate() + 1);
  }

  res.json({
    poolId: pool.id,
    poolName: pool.name,
    startDate,
    endDate,
    dates
  });
}

// Debug route - see raw API response
router.get('/debug/raw', async (req, res) => {
  try {
    const response = await fetch('https://www.geopunt.be/bff/poi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        poiType: 'Sportlokaal',
        crs: 31370,
        maxCount: 100,
        spatialRel: 'envelopeintersects',
        bbox: null,
        clustering: false
      })
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug route - see all POI names
router.get('/debug/names', async (req, res) => {
  try {
    const response = await fetch('https://www.geopunt.be/bff/poi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        poiType: 'Sportlokaal',
        crs: 31370,
        maxCount: 500,
        spatialRel: 'envelopeintersects',
        bbox: null,
        clustering: false
      })
    });
    
    const data = await response.json();
    const pois = data.result?.pois || [];
    const names = pois.map(poi => poi.labels?.find(l => l.term === 'primary')?.value);
    
    res.json({ 
      count: names.length,
      names: names.sort()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
