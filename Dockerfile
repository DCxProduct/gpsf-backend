FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
# Required by node-poppler at runtime (provides pdftocairo binary).
# fontconfig lets Poppler discover installed fonts.
# font-noto-khmer fixes Khmer previews.
# ttf-liberation is a closer fallback for Times New Roman / Arial than generic DejaVu.
RUN apk add --no-cache poppler-utils fontconfig font-noto-khmer ttf-liberation
COPY --from=builder /app/dist ./dist
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps
COPY .env .env
EXPOSE 3001
CMD ["npm", "run", "start:prod"]
