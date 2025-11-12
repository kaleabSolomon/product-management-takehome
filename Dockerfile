FROM node:20-alpine

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install

# Copy source code
COPY . .

ENV NODE_ENV=development

EXPOSE 3000


CMD ["sh", "-c", "pnpm migration:run && pnpm start:dev"]