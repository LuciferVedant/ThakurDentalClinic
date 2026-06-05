FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Pass build arguments (e.g., API URL) to Vite
ARG VITE_API_URL=http://localhost:8080/api
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

# Build the application
RUN npm run build

# Production stage using Nginx
FROM nginx:alpine

# Copy the built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy the Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
