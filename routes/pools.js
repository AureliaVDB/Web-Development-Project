const express = require('express');
const router = express.Router();
const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

// Get all swimming pools from database
router.get('/', async (req, res) => {
  try {
    const { search, type, city } = req.query;

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
    const pools = await prisma.pool.findMany({
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

    res.json({
      count: pools.length,
      filters: { search, type, city },
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
