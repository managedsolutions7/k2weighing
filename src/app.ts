// src/app.ts
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import swaggerDocs from '../docs/swagger-output.json';
import authRoutes from './routes/auth.routes';
import plantRoutes from './routes/plant.routes';
import vehicleRoutes from './routes/vehicle.routes';
import vendorRoutes from './routes/vendor.routes';
import entryRoutes from './routes/entry.routes';
import invoiceRoutes from './routes/invoice.routes';
import reportRoutes from './routes/report.routes';
import { zodErrorHandler } from './middlewares/zodErrorHandler';
import errorHandler from '@middlewares/errorHandler';
import { notFoundHandler } from '@middlewares/notFoundHandler';
import cors from 'cors';

const app = express();

app.use(express.json());

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs as any));
// Allow requests from your frontend origin only (replace with your actual frontend URL)
app.use(
  cors({
    origin: 'http://localhost:5173', // frontend URL
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true, // if you want to allow cookies/auth headers
  }),
);
// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/plants', plantRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/entries', entryRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/reports', reportRoutes);

app.use(notFoundHandler);
app.use(zodErrorHandler);
app.use(errorHandler);

export default app;
