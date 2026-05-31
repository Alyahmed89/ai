FROM node:22-alpine
ARG COOLIFY_URL=http://ui.anyapp.cfd
ARG COOLIFY_FQDN=ui.anyapp.cfd
ARG COOLIFY_BRANCH=fix-flow-run-id-capture
ARG COOLIFY_RESOURCE_UUID=krxm736mmykbhulaqe38k3yi
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3033
CMD ["npm", "run", "dev", "--", "-p", "3033"]