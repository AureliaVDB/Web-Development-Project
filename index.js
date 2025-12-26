const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Middleware
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5175';
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(helmet());
app.use(express.json());

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window for auth
  standardHeaders: true,
  legacyHeaders: false
});

// Routes
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const poolsRouter = require('./routes/pools');
const bookingsRouter = require('./routes/bookings');
const adminRouter = require('./routes/admin');
const favoritesRouter = require('./routes/favorites');

app.use('/auth', authLimiter, authRouter);
app.use('/users', usersRouter);
app.use('/pools', poolsRouter);
app.use('/bookings', bookingsRouter);
app.use('/favorites', favoritesRouter);
app.use('/admin', adminRouter);

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Swimming Pool API is running!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
