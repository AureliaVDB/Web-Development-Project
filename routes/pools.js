const express = require('express');
const router = express.Router();

// Get all swimming pools from Geopunt API
router.get('/', async (req, res) => {
  try {
    // Fetch indoor pools
    const indoorResponse = await fetch('https://www.geopunt.be/bff/poi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        poiType: 'OverdektZwembad',
        crs: 31370,
        maxCount: 1000,
        spatialRel: 'envelopeintersects',
        bbox: null,
        clustering: false
      })
    });
    
    // Fetch outdoor pools
    const outdoorResponse = await fetch('https://www.geopunt.be/bff/poi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        poiType: 'OpenluchtZwembad',
        crs: 31370,
        maxCount: 1000,
        spatialRel: 'envelopeintersects',
        bbox: null,
        clustering: false
      })
    });
    
    const indoorData = await indoorResponse.json();
    const outdoorData = await outdoorResponse.json();
    
    const indoorPools = indoorData.result?.pois || [];
    const outdoorPools = outdoorData.result?.pois || [];
    
    console.log('Indoor pools:', indoorPools.length);
    console.log('Outdoor pools:', outdoorPools.length);
    
    // Combine and map to simplified format
    const allPools = [...indoorPools, ...outdoorPools];
    
    const pools = allPools.map(poi => ({
      id: poi.id,
      name: poi.labels?.find(l => l.term === 'primary')?.value || 'Unknown',
      isIndoor: indoorPools.some(p => p.id === poi.id),
      address: poi.location?.address || null,
      coordinates: poi.location?.points?.[0]?.point?.coordinates
    }));

    res.json({
      count: pools.length,
      pools
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch pools', details: error.message });
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

// Get single pool by ID
router.get('/:id', async (req, res) => {
  try {
    const response = await fetch(`https://poi.api.geopunt.be/v1/core?id=${req.params.id}&maxmodel=true`);
    const data = await response.json();

    if (!data.pois || data.pois.length === 0) {
      return res.status(404).json({ error: 'Pool not found' });
    }

    res.json(data.pois[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pool', details: error.message });
  }
});

module.exports = router;
