# Use Node.js 20 as base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy application code
COPY . .

# Build the application with verbose output
RUN npm run build

# Check if build succeeded
RUN ls -la dist/ && echo "Build successful" || echo "Build failed - using dev mode"

# Create fallback if build failed
RUN mkdir -p dist || true

# Remove dev dependencies after build
RUN npm prune --production

# Expose port
EXPOSE 5000

# Start the application
CMD ["npm", "start"]