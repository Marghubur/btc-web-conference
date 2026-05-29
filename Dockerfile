# ─────────────────────────────────────────────
#  STAGE 1 – Build (Angular + TypeScript)
# ─────────────────────────────────────────────
# Angular requires Node ≥ 20.19 or ≥ 22.12
FROM node:22-alpine AS builder

WORKDIR /app

# Install deps first (layer-cache friendly)
# NOTE: Do NOT use --ignore-scripts — Angular 18+ uses rolldown which needs a
# postinstall script to download the correct platform-native binary.
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build -- --mode production

# ─────────────────────────────────────────────
#  STAGE 2 – Serve with Nginx
# ─────────────────────────────────────────────
FROM nginx:1.27-alpine

# Custom nginx config for React Router (SPA fallback)
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from Stage 1
COPY --from=builder /app/dist/btc-web-conference/browser /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]