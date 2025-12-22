const express = require('express');
const router = express.Router();
const { PrismaClient } = require('../generated/prisma');
const { calculateDistance } = require('../utils/distance');
const prisma = new PrismaClient();

// Get all swimming pools from database
router.get('/', async (req, res) => {
  try {
    const { search, type, city, x, y, radius } = req.query;

    // Build filter conditions
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

    // Fetch pools from database
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

    // Filter by distance if coordinates provided
    if (x && y) {
      const userX = parseFloat(x);
      const userY = parseFloat(y);
      const maxRadius = radius ? parseFloat(radius) : null;

      // Calculate distance for each pool
      pools = pools.map(pool => ({
        ...pool,
        distance: calculateDistance(userX, userY, pool.longitude, pool.latitude)
      }));

      // Filter by radius if specified
      if (maxRadius) {
        pools = pools.filter(pool => pool.distance <= maxRadius);
      }

      // Sort by distance
      pools.sort((a, b) => a.distance - b.distance);
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

// Check availability for a pool on a specific date
router.get('/:id/availability', async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date parameter required (format: YYYY-MM-DD)' });
    }

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
  } catch (error) {
    res.status(500).json({ error: 'Failed to check availability', details: error.message });
  }
});

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
