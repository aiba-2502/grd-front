# Node.js 20 LTS for Next.js 15
FROM node:20-alpine

# Install dependencies for building native modules
RUN apk add --no-cache libc6-compat python3 make g++

# Set working directory
WORKDIR /app

# Install pnpm (Next.js 15 recommended package manager)
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files (will be created by create-next-app)
# COPY frontend/package*.json frontend/pnpm-lock.yaml* ./
# RUN pnpm install --frozen-lockfile

# Expose port 3001 for Next.js
EXPOSE 3001

# Set environment to development
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

# Default command
CMD ["npm", "run", "dev"]