FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Generate Prisma Client for Supabase mapping
RUN npx prisma generate --schema=prisma/schema.prisma

# Force compile TypeScript direct into the container root level
RUN npx tsc --skipLibCheck || true

EXPOSE 3000

# Directly run the server file from the actual root path
CMD ["npx", "ts-node", "server.ts"]
