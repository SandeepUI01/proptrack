# Stage 1: Build Vue app
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Ensure Vite builds for production
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:stable-alpine
# Copy built assets to Nginx
COPY --from=builder /app/dist /usr/share/nginx/html
# Custom Nginx config to handle Vue routing and SPA behavior
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]