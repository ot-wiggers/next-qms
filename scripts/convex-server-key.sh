#!/usr/bin/env bash
# Erzeugt den Admin-Key des self-hosted Convex (Dokploy) LOKAL — ohne laufenden
# Server-Container — und schreibt URL + Key nach .env.server.local (gitignored).
# INSTANCE_NAME/INSTANCE_SECRET stehen in Dokploy → Convex-Service → Environment.
set -euo pipefail
cd "$(dirname "$0")/.."

read -rp "Convex-Backend-URL (Port-3210-Domain, z.B. https://convex.example.de): " URL
read -rp "INSTANCE_NAME [convex-self-hosted]: " NAME
NAME=${NAME:-convex-self-hosted}
read -rsp "INSTANCE_SECRET (Eingabe unsichtbar): " SECRET; echo

KEY=$(docker run --rm --entrypoint ./generate_key ghcr.io/get-convex/convex-backend:latest "$NAME" "$SECRET" | tail -n 1)
case "$KEY" in *"|"*) ;; *) echo "Unerwartete Ausgabe von generate_key" >&2; exit 1 ;; esac

umask 077
printf 'CONVEX_SELF_HOSTED_URL=%s\nCONVEX_SELF_HOSTED_ADMIN_KEY=%s\n' "$URL" "$KEY" > .env.server.local
echo "Gespeichert in .env.server.local"
curl -fsS "$URL/version" >/dev/null && echo "Backend erreichbar: $URL" || echo "WARNUNG: $URL/version nicht erreichbar (Container down?)"
