import express from 'express';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import issueRoutes from './routes/issueRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

// Main Core Route Modules
app.use('/api/auth', authRoutes);
app.use('/api/issues', issueRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the DevPulse API engine room!' });
});

app.listen(PORT, () => {
  console.log(`🚀 DevPulse Server running efficiently on port ${PORT}`);
});