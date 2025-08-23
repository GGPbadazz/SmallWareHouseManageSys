# Production-stable Dockerfile for server
FROM node:20.18.0-alpine

# Install build dependencies for better-sqlite3 and health check tools
RUN apk add --no-cache python3 make g++ curl

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies (production only for smaller image)
RUN npm ci --only=production

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p /app/database /app/backups /app/data /app/jobs /app/scripts

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3003
ENV DB_PATH=/app/database/inventory.db
ENV DATABASE_PATH=/app/database/inventory.db

# Initialize database (force create)
RUN rm -f /app/database/inventory.db && npm run init-db

# Create snapshot table and indexes (ensure snapshot system works properly)
RUN node scripts/docker-init-snapshots.js || echo "Will initialize snapshots at runtime"

# Copy Docker startup script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose port
EXPOSE 3003
ENV DATABASE_PATH=/app/database/inventory.db

# Health check - check if product API and snapshot API are working
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=5 \
  CMD sh -c "wget --quiet --tries=1 --spider http://localhost:3003/api/products && wget --quiet --tries=1 --spider http://localhost:3003/api/snapshots/stats" || exit 1

# Start application
ENTRYPOINT ["docker-entrypoint.sh"]
