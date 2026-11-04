FROM cypress/browsers:node-24.22.1-chrome-156.0.8078.73-1-ff-159.0-edge-156.0.4314.50-1

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci && npm cache clean --force

COPY . .

CMD ["npm", "run", "cy:run-audit"]