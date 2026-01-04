FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Set the API base URL at build time (required for Next.js NEXT_PUBLIC_* vars)
ARG NEXT_PUBLIC_API_BASE=https://api.mitzpe6-8.com/api
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE

RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000

CMD ["npm", "run", "start"]
