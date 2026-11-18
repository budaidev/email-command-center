FROM node:20

WORKDIR /app
COPY package.json .
RUN npm install

COPY . .
RUN mkdir -p data

EXPOSE 3002
CMD ["node", "--env-file=/app/.env", "src/index.js"]
