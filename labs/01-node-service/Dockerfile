FROM node:20-alpine

WORKDIR /app

# Install deterministic dependencies from lockfile
COPY package.json package-lock.json ./
RUN npm ci

# Copy TypeScript source and compile build-time bundle
COPY tsconfig.json ./
COPY src ./src
COPY tests ./tests
RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production
ENV PORT=3000

USER node
EXPOSE 3000

CMD ["node", "dist/src/index.js"]
