FROM node:20-alpine
LABEL title="Private-Calendar"
WORKDIR /app

# copying over what packages the program needs and downloading them
COPY package.json ./
COPY package-lock.json ./

RUN npm install

# copying the rest of our code into the container
COPY . .

# making it so android emulator can connect to the container
ENV REACT_NATIVE_PACKAGER_HOSTNAME=0.0.0.0

# documenting what ports the program uses
# ports for web:
EXPOSE 8081

# ports for mobile:
EXPOSE 19000
EXPOSE 19001
EXPOSE 19006

# starting our app
ENTRYPOINT [ "npx", "expo", "start" ]
CMD [ ]
