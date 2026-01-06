# KiKo API Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies needed for build
COPY package*.json ./
RUN npm install

# Copy source and config
COPY tsconfig.json ./
COPY prisma ./prisma/
COPY src ./src/

# Build the application
RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install production dependencies only
RUN apk add --no-cache curl
COPY package*.json ./
RUN npm ci --only=production

# Copy built assets and prisma client
COPY --from=builder /app/dist ./dist/
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma/

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Run the application
CMD ["node", "dist/index.js"]
