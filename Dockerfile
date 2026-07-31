FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/data/appointments.db

RUN mkdir -p /data /app/uploads && chown -R node:node /data /app/uploads

USER node

EXPOSE 3000

CMD ["node", "index.js"]
