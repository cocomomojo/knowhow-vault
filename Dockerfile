FROM node:20-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN npm install

COPY . .
RUN npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787

COPY --from=build /app /app

EXPOSE 8787
CMD ["npm", "--prefix", "backend", "run", "start"]
