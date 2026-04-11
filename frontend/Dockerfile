FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# Build for production
RUN npm run build

EXPOSE 3001

# Serve the production build (works reliably through reverse proxies/tunnels)
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "3001"]
