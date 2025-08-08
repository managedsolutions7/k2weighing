// src/app.ts
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import swaggerDocs from './swagger-output.json';
import authRoutes from './routes/auth.routes';
import { zodErrorHandler } from './middlewares/zodErrorHandler';
import errorHandler from '@middlewares/errorHandler';
import { notFoundHandler } from '@middlewares/notFoundHandler';

const app = express();

app.use(express.json());

app.use(notFoundHandler);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.use('/api/auth', authRoutes);

app.use(zodErrorHandler);
app.use(errorHandler);

export default app;
