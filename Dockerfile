# QMS (qms.ot-wiggers.de) als Next-standalone-Server. In Dokploy Build-Typ "Dockerfile",
# Dockerfile-Pfad ./Dockerfile, Kontext ".".
#
# Beim Build nur ÖFFENTLICHE Werte (NEXT_PUBLIC_* stehen ohnehin im JS-Bundle) — als Build-Args.
# Geheimnisse (RESEND_API_KEY, SERPER_API_KEY, …) NUR als Laufzeit-ENV in Dokploy; sie stehen damit
# weder in Layern noch in `docker history`.
# Node fest gepinnt: Dokploy baut ohne --pull, ein offener Tag (node:22-alpine) bleibt sonst auf dem
# zuletzt gezogenen Stand hängen. 22.23.4 behebt Node2Shell (CVE-2026-111497) – bei neuen
# Sicherheitsreleases hier anheben.
FROM node:22.23.4-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Default = Produktion. Dokploys Build-time Arguments kamen beim Website-Build nicht an (Schritte
# CACHED) — deshalb steht der Live-Wert hier fest; ein Staging-Build überschreibt ihn per Build-Arg.
ARG NEXT_PUBLIC_CONVEX_URL=https://convex-qms.ot-wiggers.de
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22.23.4-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static .next/static
COPY --from=build --chown=node:node /app/public public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
