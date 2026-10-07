# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Runtime stage
FROM node:22-alpine

WORKDIR /app

# Install a simple HTTP server to serve the built assets
RUN npm install -g http-server

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist

# Copy public assets
COPY --from=builder /app/public ./public

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/ || exit 1

# Run http-server
CMD ["http-server", "dist", "-p", "3000", "--cors", "-g"]
