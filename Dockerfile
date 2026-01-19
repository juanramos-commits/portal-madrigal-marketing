FROM node:18-alpine AS builder
WORKDIR /app

# Cache buster - change this to force rebuild
ARG CACHE_BUST=2026-01-19-v3

COPY package*.json ./
RUN npm ci --no-cache
COPY . .
RUN echo "Build: $CACHE_BUST" && npm run build

FROM node:18-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
