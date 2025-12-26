const express = require('express');
const router = express.Router();
const { PrismaClient } = require('../generated/prisma');
const { authenticateToken } = require('../middleware/auth');

const prisma = new PrismaClient();

// Add pool to favorites
router.post('/:poolId', authenticateToken, async (req, res) => {
  try {
    const { poolId } = req.params;

    // Check if pool exists
    const pool = await prisma.pool.findUnique({ where: { id: poolId } });
    if (!pool) {
      return res.status(404).json({ error: 'Pool not found' });
    }

    // Check if already favorited
    const existing = await prisma.userFavorite.findUnique({
      where: { userId_poolId: { userId: req.user.userId, poolId } }
    });

    if (existing) {
      return res.status(400).json({ error: 'Already favorited' });
    }

    // Add favorite
    const favorite = await prisma.userFavorite.create({
      data: {
        userId: req.user.userId,
        poolId
      }
    });

    res.status(201).json(favorite);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add favorite', details: error.message });
  }
});

// Remove pool from favorites
router.delete('/:poolId', authenticateToken, async (req, res) => {
  try {
    const { poolId } = req.params;

    // Find and delete favorite
    const favorite = await prisma.userFavorite.findUnique({
      where: { userId_poolId: { userId: req.user.userId, poolId } }
    });

    if (!favorite) {
      return res.status(404).json({ error: 'Favorite not found' });
    }

    await prisma.userFavorite.delete({
      where: { userId_poolId: { userId: req.user.userId, poolId } }
    });

    res.json({ message: 'Removed from favorites' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove favorite', details: error.message });
  }
});

// Get user's favorite pools
router.get('/', authenticateToken, async (req, res) => {
  try {
    const favorites = await prisma.userFavorite.findMany({
      where: { userId: req.user.userId },
      include: { pool: true }
    });

    res.json(favorites.map(f => f.pool));
  } catch (error) {
    res.status(500).json({ error: 'Failed to get favorites', details: error.message });
  }
});

module.exports = router;
