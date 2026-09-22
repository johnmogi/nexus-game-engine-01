# NEXUS Lab — run anywhere Docker is available (local VM, cloud box, Codespaces).
FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps ./apps
COPY config ./config

RUN npm ci

EXPOSE 5173

# Vite already binds host:true; publish 5173:5173 from compose/run.
CMD ["npm", "run", "lab", "--", "--host", "0.0.0.0", "--port", "5173"]
