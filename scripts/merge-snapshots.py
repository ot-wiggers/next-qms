# Führt zwei Convex-Snapshots zusammen (einmalig, 2026-09):
#   BASIS  = Cloud-Dev-Snapshot (QM-Jahreszyklus + Import 2026, IDs bleiben)
#   SERVER = Snapshot des self-hosted Servers (22 Benutzer + Passwörter, E-Learning, …)
# Server-IDs werden auf die Tabellennummern der Basis umgerechnet (Convex-ID =
# base32(vint(Tabellennr.) + 16 Byte interne ID + Fletcher-16 mod 256)).
#   python3 scripts/merge-snapshots.py <basis.zip> <server.zip> <ziel.zip>
import json, sys, zipfile
from collections import defaultdict

ALPH = "0123456789abcdefghjkmnpqrstvwxyz"


def b32dec(s):
    bits = n = 0; out = bytearray()
    for ch in s:
        bits = (bits << 5) | ALPH.index(ch); n += 5
        if n >= 8: n -= 8; out.append((bits >> n) & 0xFF)
    return bytes(out)


def b32enc(b):
    bits = n = 0; out = []
    for byte in b:
        bits = (bits << 8) | byte; n += 8
        while n >= 5: n -= 5; out.append(ALPH[(bits >> n) & 31])
    if n: out.append(ALPH[(bits << (5 - n)) & 31])
    return "".join(out)


def vint_enc(v):
    out = bytearray()
    while True:
        x = v & 0x7F; v >>= 7
        if v: out.append(x | 0x80)
        else: out.append(x); return bytes(out)


def checksum(b):
    a = c = 0
    for x in b: a = (a + x) % 256; c = (c + a) % 256
    return bytes([a, c])


def encode(table, internal):
    body = vint_enc(table) + internal
    return b32enc(body + checksum(body))


def decode(s):
    """(Tabellennr., interne ID) oder None, wenn s keine gültige Convex-ID ist."""
    if not (31 <= len(s) <= 37) or any(ch not in ALPH for ch in s):
        return None
    raw = b32dec(s); v = shift = 0
    for k, x in enumerate(raw[:5]):
        v |= (x & 0x7F) << shift; shift += 7
        if not x & 0x80: break
    else:
        return None
    internal = raw[k + 1:k + 17]
    if len(internal) != 16 or encode(v, internal) != s:
        return None
    return v, internal


def read(z, table):
    try:
        return [json.loads(l) for l in z.read(f"{table}/documents.jsonl").decode().splitlines() if l.strip()]
    except KeyError:
        return []


def main(base_path, server_path, out_path):
    B, S = zipfile.ZipFile(base_path), zipfile.ZipFile(server_path)
    b_tables = {r["name"]: r["id"] for r in read(B, "_tables")}
    s_tables = {r["name"]: r["id"] for r in read(S, "_tables")}
    s_num_to_name = {v: k for k, v in s_tables.items()}
    STORAGE = 540  # _storage ist in beiden Snapshots gleich nummeriert (geprüft)

    out = defaultdict(list)
    for t in b_tables:
        out[t] = read(B, t)
    out["_storage"] = read(B, "_storage")

    # ---- Testdaten aus der Basis entfernen (siehe Memory/Walkthroughs) ----
    drop_ids = set()
    def drop(table, pred):
        keep = []
        for r in out[table]:
            if pred(r): drop_ids.add(r["_id"])
            else: keep.append(r)
        out[table] = keep
    drop("capas", lambda r: r["capaNumber"] in ("CAPA-2026-12", "CAPA-2026-13"))
    drop("complaints", lambda r: r.get("complaintNumber") == "REK-2026-01")
    drop("documentRecords", lambda r: r["documentCode"] == "LEAK-001")
    drop("deviceRecords", lambda r: r["inventoryNumber"] in ("PM-001", "PM-002", "PM-003"))
    drop("incomingGoodsChecks", lambda r: r.get("manufacturer") == "Test-Hersteller Walkthrough")
    # abhängige Datensätze
    drop("capaMeasures", lambda r: r["capaId"] in drop_ids)
    drop("deviceCalibrations", lambda r: r["deviceId"] in drop_ids)
    drop("tasks", lambda r: r.get("resourceId") in drop_ids)
    drop("notifications", lambda r: r.get("resourceId") in drop_ids)
    # CAPA-Nummernkreis schließen: 14/15 (Überwachungsaudit) → 12/13
    for r in out["capas"]:
        if r["capaNumber"] in ("CAPA-2026-14", "CAPA-2026-15"):
            r["seq"] -= 2; r["capaNumber"] = f"CAPA-2026-{int(r['seq']):02d}"

    # ---- Zuordnungen Server → Basis ----
    base_users = read(B, "users"); srv_users = read(S, "users")
    base_org = next(r for r in read(B, "organizations") if r["type"] == "organization")
    srv_org = next(r for r in read(S, "organizations") if r["type"] == "organization")
    fixed = {srv_org["_id"]: base_org["_id"]}
    base_by_mail = {u["email"].lower(): u for u in base_users}
    for u in srv_users:
        if u["email"].lower() in base_by_mail:
            fixed[u["_id"]] = base_by_mail[u["email"].lower()]["_id"]

    stats = defaultdict(int)
    def remap(v):
        if isinstance(v, dict): return {k: remap(x) for k, x in v.items()}
        if isinstance(v, list): return [remap(x) for x in v]
        if isinstance(v, str):
            if v in fixed: return fixed[v]
            d = decode(v)
            if d and d[0] in s_num_to_name:
                stats["ids"] += 1
                return encode(b_tables[s_num_to_name[d[0]]], d[1])
        return v

    # Auth komplett vom Server (Passwörter!), Basis-Auth verwerfen
    for t in ("authAccounts", "authSessions", "authRefreshTokens", "authVerifiers",
              "authVerificationCodes", "authRateLimits"):
        out[t] = [remap(r) for r in read(S, t)]
    # Server-Benutzer: Dubletten (gleiche E-Mail) behalten die Basis-ID + Basis-Datensatz
    for u in srv_users:
        if u["_id"] not in fixed:
            out["users"].append(remap(u))
    # Tabellen, die angehängt werden (Organisation/Flags/HMV-Cache bleiben aus der Basis)
    for t in ("trainings", "trainingSessions", "trainingParticipants", "trainingFeedback",
              "certificates", "trainingRequests", "complaints", "tasks", "notifications", "auditLog"):
        out[t] += [remap(r) for r in read(S, t)]
    have_hmv = {r["hmvNummer"] for r in out["hmvCache"]}
    out["hmvCache"] += [remap(r) for r in read(S, "hmvCache") if r["hmvNummer"] not in have_hmv]

    # Storage: Metadaten + Dateien beider Seiten
    storage_files = {}
    for z in (B, S):
        for n in z.namelist():
            if n.startswith("_storage/") and not n.endswith(".jsonl"):
                storage_files[n] = z
    out["_storage"] += read(S, "_storage")

    # Konsistenz: keine doppelten IDs, alle Referenzen auf users/organizations auflösbar
    all_ids = set()
    for t, rows in out.items():
        for r in rows:
            assert r["_id"] not in all_ids, f"Doppelte ID {r['_id']} in {t}"
            all_ids.add(r["_id"])
    user_ids = {u["_id"] for u in out["users"]}
    for t in ("authAccounts", "trainingParticipants", "certificates"):
        for r in out[t]:
            assert r["userId"] in user_ids, f"{t}: userId {r['userId']} unbekannt"

    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as Z:
        Z.writestr("_tables/documents.jsonl", B.read("_tables/documents.jsonl"))
        for t, rows in out.items():
            Z.writestr(f"{t}/documents.jsonl", "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows))
            if t != "_storage":
                Z.writestr(f"{t}/generated_schema.jsonl", '"uniform"\n')
        for n, z in storage_files.items():
            Z.writestr(n, z.read(n))

    print(f"umgeschriebene IDs: {stats['ids']}, entfernte Testdatensätze: {len(drop_ids)}")
    for t in ("users", "authAccounts", "organizations", "capas", "complaints", "tasks",
              "documentRecords", "deviceRecords", "incomingGoodsChecks", "trainings", "_storage"):
        print(f"  {t}: {len(out[t])}")


if __name__ == "__main__":
    main(*sys.argv[1:4])
