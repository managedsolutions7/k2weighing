# ---------- Build Stage ----------
FROM node:20-alpine AS build
WORKDIR /app

# Install deps
COPY package*.json tsconfig.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# ---------- Runtime Stage ----------
FROM node:20-alpine AS runtime
WORKDIR /app

# Copy only production deps
COPY package*.json ./
RUN npm ci --only=production

# Copy compiled code from build stage
COPY --from=build /app/dist ./dist

EXPOSE 8080
CMD ["node", "dist/server.js"]
