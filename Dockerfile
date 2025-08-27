# ---- Base Stage ----
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

# ---- Build Stage ----
FROM base AS build
# Install all dependencies (including dev) for build
RUN npm install
COPY . .
# Compile TypeScript
RUN npm run build

# ---- Production Stage ----
FROM node:20-alpine AS production
WORKDIR /app

# Copy only prod dependencies
COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts


# Copy built files from build stage
COPY --from=build /app/dist ./dist

# Expose app port (adjust if needed)
EXPOSE 8080

# Start the server
CMD ["node", "dist/server.js"]
