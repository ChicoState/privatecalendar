FROM node:20-alpine
LABEL title="Private-Calendar"
WORKDIR /app

COPY package.json ./
COPY package-lock.json ./

RUN npm install

COPY . .

ENV REACT_NATIVE_PACKAGER_HOSTNAME=0.0.0.0
EXPOSE 8081
EXPOSE 19000
EXPOSE 19001
EXPOSE 19006

ENTRYPOINT [ "npx", "expo", "start", "--web"]
CMD [ ]