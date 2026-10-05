# Build context is the repo root: docker build -f apps/api/Dockerfile .
FROM node:24-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/mobile/package.json apps/mobile/
RUN npm ci -w apps/api --ignore-scripts
COPY apps/api apps/api
RUN npm run build -w apps/api

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/mobile/package.json apps/mobile/
RUN npm ci -w apps/api --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY apps/api/drizzle apps/api/drizzle
RUN mkdir /data && chown node:node /data
USER node
WORKDIR /repo/apps/api
EXPOSE 3000
CMD ["node", "dist/index.js"]
