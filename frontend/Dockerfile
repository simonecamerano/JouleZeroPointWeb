# Stage 1: Build
FROM node:24-alpine AS build

WORKDIR /app

COPY package*.json ./

# Force NODE_ENV to development to ensure devDependencies (like vite) are installed.
# Coolify injects the resource variables as ARG after each FROM, and with
# NODE_ENV=production npm skips devDependencies, which makes the build below fail
# with "vite: not found". Same guard as backend/Dockerfile.
ENV NODE_ENV=development

RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

# Stage 2: Serve
FROM nginx:stable-alpine

# Copy the build output from the previous stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx configuration for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
