# ---------- Base Stage ----------
FROM node:22-alpine AS base

WORKDIR /app

# Install only dependencies first (better caching)
COPY package*.json ./
RUN npm ci --only=production

# ---------- Build Stage ----------
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm install

COPY . .
RUN npm run build

# ---------- Final Runtime Stage ----------
FROM node:22-alpine AS runtime

WORKDIR /app

# Copy only built artifacts & node_modules from base
COPY --from=base /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./

# Expose Elastic Beanstalk expected port
EXPOSE 8080

# Start the app
CMD ["node", "dist/server.js"]
