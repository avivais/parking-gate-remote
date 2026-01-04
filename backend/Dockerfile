FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built application
COPY dist/ ./dist/

# Expose port
EXPOSE 3001

# Start the application
CMD ["node", "dist/main.js"]

