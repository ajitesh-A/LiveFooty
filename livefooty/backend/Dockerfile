FROM node:22-bookworm-slim

# Chromium system deps for headless puppeteer
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates fonts-liberation \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libasound2 libpango-1.0-0 libcairo2 \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=false

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npx puppeteer browsers install chrome && rm -rf /root/.cache/puppeteer

COPY src ./src

ENV PORT=3001
EXPOSE 3001

CMD ["node", "src/index.js"]