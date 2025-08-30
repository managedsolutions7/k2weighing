// src/app.ts
import express from 'express';
import authRoutes from './routes/auth.routes';
import plantRoutes from './routes/plant.routes';
import vehicleRoutes from './routes/vehicle.routes';
import vendorRoutes from './routes/vendor.routes';
import entryRoutes from './routes/entry.routes';
import invoiceRoutes from './routes/invoice.routes';
import reportRoutes from './routes/report.routes';
import dashboardRoutes from './routes/dashboard.routes';
import enhancedDashboardRoutes from './routes/enhanced-dashboard.routes';
import materialRoutes from './routes/material.routes';
import { zodErrorHandler } from './middlewares/zodErrorHandler';
import errorHandler from '@middlewares/errorHandler';
import { notFoundHandler } from '@middlewares/notFoundHandler';
import cors from 'cors';
import { env } from './config/env';

const app = express();

app.use(express.json());

app.use(
  cors({
    origin: env.ALLOWED_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  }),
);

// Health check endpoint for Elastic Beanstalk
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'Weighing App Backend API',
    version: '1.0.0',
    status: 'running'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/plants', plantRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/entries', entryRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/enhanced-dashboard', enhancedDashboardRoutes);
app.use('/api/materials', materialRoutes);

app.use(notFoundHandler);
app.use(zodErrorHandler);
app.use(errorHandler);

export default app;
