# Imagen oficial de Playwright que ya trae Chromium + dependencias del SO
FROM mcr.microsoft.com/playwright:v1.43.0-jammy

WORKDIR /app

# Evita que el postinstall de playwright vuelva a descargar browsers
# (la imagen ya los tiene en /ms-playwright)
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Instalar dependencias primero (mejor caching de capas Docker)
COPY package.json package-lock.json ./
RUN npm ci

# Copiar el resto del código
COPY . .

# Build de Next.js
RUN npm run build

# Cloud Run inyecta PORT — Next.js lo respeta cuando arranca con `next start -p $PORT`
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "npx next start -p ${PORT}"]
