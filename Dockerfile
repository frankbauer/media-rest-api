FROM node:18-alpine

# We need curl and jq for the healthcheck
RUN apk add --no-cache curl jq

# Setup node environment
RUN mkdir -p ./data/uploads
WORKDIR /app
COPY package*.json ./
COPY src/ ./src/
RUN npm ci --only=production

EXPOSE 3000

# Health check of our REST-API
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health | jq -e '.status == "healthy"' > /dev/null || exit 1

CMD ["node", "src/index.js"]
