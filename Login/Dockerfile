FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build Angular (production)
RUN npm run build -- --configuration production

FROM nginx:1.27-alpine

COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Angular build output for @angular/build:application is under dist/browser (we set outputPath=dist)
COPY --from=build /app/dist/browser /usr/share/nginx/html
