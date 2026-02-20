FROM node:18-alpine AS builder
ARG CACHEBUST=2
WORKDIR /app

# Cache buster - change this to force rebuild
ARG CACHE_BUST=2026-02-20-v4

# Supabase env vars needed at build time (Vite inlines them)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

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
