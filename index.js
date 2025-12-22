const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const poolsRouter = require('./routes/pools');
const bookingsRouter = require('./routes/bookings');

app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/pools', poolsRouter);
app.use('/bookings', bookingsRouter);

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Swimming Pool API is running!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
