FROM node:20
WORKDIR /app

COPY package*.json ./
RUN npm install && npm install -g esbuild

COPY . .

RUN chmod -R 755 node_modules && npm run build

EXPOSE 3000
CMD ["npm", "run", "preview", "--", "--port", "3000", "--host", "0.0.0.0"]
