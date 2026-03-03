FROM node:18-alpine AS builder
ARG CACHEBUST=2
WORKDIR /app

# Cache buster - change this to force rebuild
ARG CACHE_BUST=2026-03-03-v1

# Supabase env vars needed at build time (Vite inlines them)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

COPY package*.json ./
RUN npm ci --no-cache
COPY . .
RUN echo "Build: $CACHE_BUST" && npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
