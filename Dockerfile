FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Generate Prisma Client
RUN npx prisma generate --schema=prisma/schema.prisma

# Compile TypeScript to JavaScript (Creates the dist folder)
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
