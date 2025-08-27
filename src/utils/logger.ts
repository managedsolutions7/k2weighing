// src/utils/logger.ts
import { createLogger, format, transports } from 'winston';

const { combine, timestamp, json, errors, splat } = format;

// JSON structured logs to stdout; no file rotation to avoid local disk use
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(timestamp(), errors({ stack: true }), splat(), json()),
  transports: [new transports.Console()],
});

// Note: In production on AWS, ship stdout/stderr to CloudWatch Logs (ECS/EKS/Elastic Beanstalk)
// If needed, add a CloudWatch transport in a separate step.

export default logger;
