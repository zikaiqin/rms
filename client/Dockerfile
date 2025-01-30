FROM node:22.13-alpine AS build

WORKDIR /app

# FIXME: package-lock.json generated on windows causes compatibility issues when deploying on alpine (@rollup-linux)
# FIXME: add package-lock.json once dev mode is also containerized
COPY package.json ./

RUN npm i
COPY . .
RUN npm run build

###############################################################################

FROM nginx:1.27.3-alpine-slim
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

CMD ["nginx", "-g", "daemon off;"]
