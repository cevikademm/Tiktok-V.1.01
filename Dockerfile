# ─── Overlay Connector Worker — Railway/Docker imajı (ADR-0003) ───────────────
# Bu Dockerfile YALNIZ connector worker'ı içindir. Vercel bunu yok sayar (kendi
# Next.js build'ini kullanır); Railway/Docker bunu kullanır. Yerelde çalışan
# ortamı (Node 22 + pnpm 11) birebir kopyalar → deterministik kurulum.

FROM node:22-slim

WORKDIR /app

# pnpm'i package.json'daki "packageManager" sürümüyle sabitle (corepack).
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@11.13.0 --activate

# Bağımlılıklar (lockfile ile deterministik). Dep katmanı önce → cache dostu.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Kaynak kod (connector + lib/*). .dockerignore node_modules/.next/.env'i hariç tutar.
COPY . .

# Web servisi DEĞİL — port dinlemez. Connector'ı çalıştırır (tsx üzerinden).
CMD ["pnpm", "connector"]
