FROM node:20-alpine
LABEL title="Private-Calendar"
WORKDIR /app

COPY package.json ./
COPY package-lock.json ./

RUN npm install

COPY . .

ENV HOST=0.0.0.0 PORT=8081
EXPOSE 8081

CMD [ "npx", "expo", "start"]