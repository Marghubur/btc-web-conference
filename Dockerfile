#   BUILD STAGE 1

FROM node:20.16.0 as node
WORKDIR /app

COPY . .

RUN npm install

# Add build config as argument
ARG BUILD_CONFIG=production
ENV BUILD_CONFIG=$BUILD_CONFIG

RUN npm run build -- --configuration $BUILD_CONFIG

# STAGE 2
FROM nginx:alpine
COPY --from=node /app/dist/btc-web-conference/browser /usr/share/nginx/html
