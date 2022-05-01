FROM node:16-alpine
EXPOSE 3104
WORKDIR /app
COPY package.json .
RUN npm install
RUN npm install knex -g
COPY . .
RUN npm remove toidentifier
CMD [ "sh", "scripts/start.sh"]
