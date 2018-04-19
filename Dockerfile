FROM node:8.10.0-alpine

ARG APP_HOME=/app
RUN mkdir -p $APP_HOME
WORKDIR $APP_HOME

COPY package.json yarn.lock ./

RUN yarn install

COPY . .
