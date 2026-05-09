FROM node:20-alpine

ENV NODE_ENV=production

WORKDIR /app

# Install dependencies first (layer cache)
COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN mkdir -p logs

EXPOSE 3001

CMD ["node", "src/server.js"]
