FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    wget \
    && wget -q -O /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    && apt-get install -y /tmp/chrome.deb \
    && rm /tmp/chrome.deb \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV CHROME_PATH=/usr/bin/google-chrome-stable
EXPOSE 3000

CMD ["node", "server.js"]
