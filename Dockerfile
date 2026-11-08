# Stage 1: Build Web Application (React + Vite)
FROM node:22-alpine AS web-builder
WORKDIR /app/apps/web
COPY apps/web/package*.json ./
RUN npm install
COPY apps/web/ ./
RUN npm run build

# Stage 2: API Server & WebFig Reverse Proxy
FROM node:22-alpine
WORKDIR /app/apps/api
RUN apk add --no-cache python3 make g++
COPY apps/api/package*.json ./
RUN npm install --omit=dev
COPY apps/api/ ./

# Copy compiled frontend assets into API static directory
COPY --from=web-builder /app/apps/web/dist /app/apps/api/public

EXPOSE 3000 58123
CMD ["node", "src/server.js"]
