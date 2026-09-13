require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/upload');
const batchRoutes = require('./routes/batches');
const passengerRoutes = require('./routes/passengers');
const analyticsRoutes = require('./routes/analytics');

const app = express();

app.use(cors({ origin: (process.env.CORS_ORIGIN || '').split(',') }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/passengers', passengerRoutes);
app.use('/api/analytics', analyticsRoutes);

// Central error handler (e.g. multer file-type rejections)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(400).json({ error: err.message });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚍 Transport analytics API running on port ${PORT}`));
