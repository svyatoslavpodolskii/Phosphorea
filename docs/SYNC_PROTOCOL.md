# Sync protocol 1

## Pairing and authenticated sessions

The browser keeps a non-exportable ECDSA P-256 private key in IndexedDB. The
identity fingerprint is SHA-256 of the canonical public EC JWK fields. Public
PeerJS IDs contain this fingerprint; possession of an ID is not authentication.

A ten-minute invitation contains the peer ID, pinned fingerprint, a CSPRNG
256-bit secret and expiry. It is encoded in a URL fragment, never a query string.
The app removes the fragment immediately on entry. Do not log invitation URLs.
Showing/scanning is symmetric in product terms; host/guest are connection roles.

Trust is device-wide and pins both the remote public key and approved incoming/outgoing
workspace scope IDs. Signed-key authentication is followed by an encrypted manifest.
An expanded selection requires fresh consent before any records are exported.
The current maps are explicitly merged on first pairing; additional scopes are kept
as separate workspaces. Scope-to-local-workspace mappings are persisted per pair.

Each side creates an ephemeral ECDH P-256 key and a 256-bit nonce. Both first
exchange SHA-256 commitments to their complete hello; neither reveals the hello
before receiving the other's commitment. A mismatched reveal terminates pairing.
This prevents adaptive key selection/birthday search against the emoji SAS.
A plaintext hello contains public keys, nonce, device label, protocol version and the hash
of the invitation secret (not the secret). The canonical transcript binds both
hellos and their host/guest roles. The host requires an active invitation for an
unknown fingerprint; a previously trusted fingerprint may reconnect without one.

ECDH output is input to HKDF-SHA256, salted by SHA-256 of the invitation secret
and transcript. Label-separated derivations produce independent AES-GCM-256
keys for each direction and a 36-bit short authentication string displayed as
six symbols from a fixed 64-emoji alphabet. Each side sends an encrypted proof:
an ECDSA-SHA256 signature of the full transcript. Identity pinning, signature and
key confirmation precede any synchronization data. Unknown identities require
local confirmation on each device with existing data. An entirely empty device
automatically accepts after authenticated manifest exchange; the source still
requires emoji verification. Known identities authenticate the stored key
automatically; no server-issued identity or room-admin privilege is accepted.

Every encrypted frame carries a strictly increasing 64-bit sequence number.
The IV is four zero bytes plus that number, unique per direction/session key.
The transcript is AES-GCM additional authenticated data. Replay, reordering,
tampering, oversized messages and unknown protocol messages terminate the session.
The plaintext hello is bounded to 4 KB. Initial authentication has a 15-second
timeout; comparison has two minutes. An invitation is retired after authorization.

PeerJS signaling/STUN/TURN metadata is not secret. TURN may relay encrypted
packets. No server-side note persistence is part of this design. Network service
availability is distinct from authentication and confidentiality.

## Durable multi-writer records

An atom, link or note-type catalog is a multi-value register. Each head contains
a random version ID, causal vector, value or null tombstone, display timestamp
and device label. Timestamps/revision numbers never decide concurrent winners.
The merge is the union of causally maximal heads, with deterministic ordering;
equal values do not count as a conflict, but retain causal provenance.

Local graph writes and their register updates commit in the SAME SQLite
transaction, including plugin writes, manual positions, deletes and cascading
link tombstones. Histories are stored in namespaced settings so existing full
SQLite backups include them without a destructive schema migration. An incoming
batch is validated before a transaction; metadata and materialized graph commit
together. Missing endpoints defer materialization of edges without discarding
their causal records. UUID aliases of the same edge are materialized consistently
and all observed aliases receive a tombstone on deletion.

The local actor is bound to the browser identity and has a persistent monotonic
counter. A different browser or full restore gets a new actor; a copied database
cannot reuse the old writer. Continuing an unresolved note starts a causal branch
from the visible version, preserving alternatives. Explicit conflict resolution
observes all heads and produces a dominating version. Simultaneous incompatible
resolutions remain concurrent. Keeping both creates independent notes and copies
their existing edges. Stale resolution requests are rejected optimistically.

UI materializes a deterministic version until the user decides; it keeps ALL
maximal alternatives locally and in full backups. A single accepted batch may
be present locally even if the final acknowledgment was interrupted. Repeating
the exchange is idempotent. Users should not interpret a transport error as a
rollback of an already committed batch.

Transfers are bounded to 64 MiB, chunked into 18 KB plaintext chunks with
sequence/size/order checks and SHA-256 integrity of the assembled envelope.
Each chunk is independently authenticated/encrypted. DataChannel buffering has
backpressure and timeout limits. The receiver applies only a complete envelope.
New local edits during exchange are not acknowledged as sent; sync again to carry
changes made after that side's export. The UI keeps editing outside the session.

## Trust boundaries and limitations

Only atoms, links and the validated note-type catalog can be imported. Remote
settings cannot install plugins, change preferences, replace trust or obtain a
filesystem handle. Private keys and local permissions do not travel with notes.
Restoring a full backup clears copied trust and the local actor marker but retains
register histories. Current workspace data is exchanged; the workspace catalog is
not. External Obsidian attachment bytes remain external and are not transferred.

This is application-level confidentiality/authentication in transit, not disk
encryption or protection against a malicious application update, browser extension
or compromised trusted endpoint. The protocol has automated adversarial tests,
not an independent cryptographic audit. Keep source and protocol reviewable;
do not advertise absolute security or a serverless network connection.
