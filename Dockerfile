# --- build stage ---
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY tsconfig.json ./
COPY index.ts ./
COPY src ./src
RUN npm run build

# --- runtime stage ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5090

COPY package*.json ./
RUN npm install --legacy-peer-deps --omit=dev

COPY --from=build /app/dist ./dist
RUN mkdir -p uploads

EXPOSE 5090

CMD ["node", "dist/index.js"]
