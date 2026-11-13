# Protocol — the checker result on the wire (v1)

This is the exact format the checker CLI and the platform share (roadmap T12). The code is in
`packages/shared/src/{canonical,result-schema,signing}.ts`; the test is
`scripts/test-protocol-vectors.mjs`. Read `checker.md` first for the reasons.

**What it protects.** The record: a result cannot be changed on the way, sent twice, sent for
another check, or sent as another learner or device. **What it does not protect.** It does not
prove the checks really ran; the learner controls the machine (`decisions.md`, Known limits).

## 1. Overview

```text
CLI                                   Platform
 |-- ask for a challenge ------------->|  issue: challenge (canonical JSON) + stamp (HMAC)
 |<------------- challenge, stamp -----|  nothing is stored
 |  run the check, build the result    |
 |  payload = canonical JSON           |
 |  signature = Ed25519(context+payload)
 |-- challenge, stamp, payload, signature -->
 |                                     |  verify (section 8), then record_check_run()
```

The CLI posts **four strings**: `challenge`, `stamp`, `payload`, `signature`. The platform
trusts nothing else in the request.

## 2. Canonical JSON

One value has exactly one byte form.

| Rule | Detail |
| :--- | :--- |
| Encoding | UTF-8, no byte-order mark |
| Whitespace | None, anywhere |
| Object keys | Sorted by UTF-16 code unit (plain JavaScript string order); no duplicates |
| Strings | Escaped exactly as `JSON.stringify` does: `\"` `\\` `\b` `\f` `\n` `\r` `\t`, other characters below U+0020 as `\u00xx` (lowercase hex); everything else literal. A lone surrogate is refused |
| Numbers | Safe integers only, in plain decimal. No fraction, no exponent, no `-0`, no `NaN`, no `Infinity` |
| Values allowed | `null`, `true`, `false`, integer, string, array, plain object |
| Refused | `undefined` (also as a field or array item), functions, symbols, bigint, dates, maps, class instances, sparse arrays, values that refer to themselves |

Times are whole seconds since 1970-01-01 UTC (integers), so no number ever needs a fraction.

**Receiving.** `parseCanonical(text)` parses the text and accepts it only if writing the parsed
value again gives the same text. This refuses duplicate keys, another key order, whitespace,
`1.0`, `1e2`, `\/` and `A`. A receiver always verifies the signature over the characters
it received and only then reads them, so what is verified is what is used.

## 3. The result payload

All fields are required. Unknown fields are refused at every level, so there is no place to
put source code.

| Field | Type and limit | Meaning |
| :--- | :--- | :--- |
| `v` | `1` | Protocol version |
| `kind` | `"academy.check-result"` | Stops a challenge being taken for a result |
| `check.id` | slug, ≤ 80 | For example `m1-p1` |
| `check.version` | `n.n.n` | The check's version |
| `check.sha256` | 64 lowercase hex | Hash of the check folder, from `content/manifest.json` |
| `challenge.nonce` | 16–128 chars of `A–Z a–z 0–9 _ -` | The platform's one-time value |
| `challenge.expires_at` | integer seconds | Copied from the challenge |
| `device_id` | lowercase UUID | The device that signs |
| `user_id` | lowercase UUID | The learner |
| `commit.sha` | `null` or 7–64 lowercase hex | Git commit of the project |
| `commit.clean` | `null`, `true`, `false` | No uncommitted change; `null` when there is no commit |
| `checker_version` | one line, 1–40 | Version of the CLI |
| `started_at`, `finished_at` | integer seconds | `finished_at` ≥ `started_at` |
| `passed` | boolean | Must equal the rule below |
| `results.steps` | 1–60 items | One per step of the check |

Each step: `id` (slug, ≤ 60, unique), `kind` (`files` `doc` `git` `tests` `static` `sql`
`page`), `title` (one line, 1–120), `required` (boolean), `outcome` (`pass` `fail` `needs`
`skipped`), `reasons` (0–5 strings, each one line of 1–300 characters).

- **One line** means no line break, tab or other control character. A reason says what is
  wrong; it is never program output or code.
- **`passed` rule:** there is at least one required step and every required step is `pass`.
  A payload whose `passed` disagrees with its steps is refused.
- **Size:** the canonical bytes of `results` must be ≤ 32,768. The table allows 64 kB
  (`0004_devices_check_runs.sql`), so a valid result always fits.

`check_runs` columns come from the payload: `nonce`, `commit_sha`, `tree_clean`, `passed`,
`results`, `checker_version`, `started_at`, `finished_at`; `signature` is stored as sent.

## 4. Device key and signature

| Item | Format |
| :--- | :--- |
| Algorithm | Ed25519 (RFC 8032), from `node:crypto`; no other library |
| Private key | A 32-byte seed, kept on the learner's machine (file mode 600). Never sent |
| Public key, as stored in `devices.public_key` | `ed25519:` + base64url (no padding) of the 32 raw bytes: 51 characters |
| Signed message | the bytes of `gpis-academy/check-result/v1` + line feed (0x0A) + the payload characters, in UTF-8 |
| Signature | 64 bytes, base64url without padding: 86 characters |

Base64url is strict: only `A–Z a–z 0–9 _ -`, no `=`, and the text must be the one encoding of
its bytes.

The signature covers, through the payload: the check (id, version, hash), the nonce and its
expiry, the device, the learner, and every outcome.

## 5. Challenge and its stamp

A challenge is canonical JSON with exactly these fields:

| Field | Value |
| :--- | :--- |
| `v`, `kind` | `1`, `"academy.challenge"` |
| `nonce` | 24 random bytes in base64url: 32 characters |
| `user_id`, `device_id` | The signed-in learner and the device asking |
| `check` | `id`, `version`, `sha256` of the published check |
| `issued_at`, `expires_at` | Integer seconds; `expires_at` = `issued_at` + 900 |

`stamp` = base64url( HMAC-SHA256( challenge key, `gpis-academy/challenge/v1` + LF + challenge ) ),
43 characters. The challenge key is a server-only secret of at least 32 bytes. The platform
stores nothing when it issues a challenge; the stamp proves later that it issued it.

A challenge is accepted while `now ≤ expires_at`, and refused if `issued_at` is more than 60
seconds ahead of the server clock or if its life is not 1–900 seconds.

## 6. Record stamp (route → database)

`record_check_run()` (T19) is the only way into `check_runs`. So that it cannot be called
without the route, the route passes a second stamp, which the database recomputes:

```text
record stamp = lowercase hex of HMAC-SHA256( record key,
  "gpis-academy/record/v1" LF user_id LF device_id LF definition_id LF nonce LF payload_sha256 )
```

- `definition_id` is the `check_definitions.id`, in plain decimal.
- `payload_sha256` is the lowercase hex SHA-256 of the payload characters (UTF-8).
- The record key is a **different** secret from the challenge key (≥ 32 bytes). The route
  holds it as a server-only setting; the database holds it in a table no role can read.
- In PostgreSQL: `encode(hmac(convert_to(message, 'UTF8'), key, 'sha256'), 'hex')` (pgcrypto).

## 7. Why the pieces cannot be mixed up

Each of the three keyed operations starts its message with its own context line, and the two
JSON documents carry a different `kind`. A challenge stamp is never a record stamp; a signed
result is never a challenge; a signature made for another purpose with the same device key
does not verify here.

## 8. What the platform checks, in order (for T19)

`verifySubmission()` does steps 3–10 and needs no database. T19 does the rest.

| # | Check | Refusal |
| :--- | :--- | :--- |
| 1 | The request is from a signed-in learner (`getClaims()`); body is four strings within size limits | 401 / 400 |
| 2 | Read the challenge only to find `device_id` and `check`; look up the device (must belong to the signed-in learner, `revoked_at is null`) and the `check_definitions` row for `check.id` + `check.version` (its `sha256` is the expected hash) | device or check not found |
| 3 | The challenge stamp is the platform's own (constant-time compare) | `challenge_stamp` |
| 4 | The challenge is canonical and well formed | `challenge_malformed` |
| 5 | Not expired; not dated in the future | `challenge_expired`, `challenge_not_yet_valid` |
| 6 | The challenge is for the signed-in learner, the looked-up device, and the published check (id, version, hash) | `expected_user`, `expected_device`, `expected_check` |
| 7 | The signature verifies over the received payload characters with the device's stored key | `signature` |
| 8 | The payload is canonical | `payload_malformed` |
| 9 | The payload fits the schema (section 3) | `payload_invalid` |
| 10 | The payload names the same nonce, expiry, learner, device and check as the challenge | `mismatch_*` |
| 11 | Compute the record stamp and call `record_check_run()` | — |
| 12 | In the function: recompute the stamp; `user_id = auth.uid()`; device not revoked; insert. The `nonce` is UNIQUE, so a second use fails: answer "already recorded" | replay |

Rules T19 must keep:

- **Reuse of a challenge is stopped only by the database** (`check_runs.nonce` is unique). The
  format cannot see reuse; `verifySubmission()` accepts the same submission twice.
- Order matters: the stamp before anything is believed from the challenge; the signature before
  anything is believed from the payload.
- The same generic answer for "device not found", "revoked" and "bad signature" is fine for the
  CLI; log the code on the server, never the payload.
- `signing.ts` uses `node:crypto`: the two routes must run on the Node runtime, not Edge.

## 9. Test vectors

All values below are checked by `scripts/test-protocol-vectors.mjs`. Ed25519 signatures are
deterministic, so anyone can reproduce them.

| Item | Value |
| :--- | :--- |
| Device A seed | the 32 bytes `01 02 03 … 20` (hex) |
| Device A public key | `ed25519:ebVWLo_mVPlAeLES6KmLp5AfhTrmlb7X4OORC60ElmQ` |
| Device B seed | the 32 bytes `21 22 23 … 40` (hex) |
| Device B public key | `ed25519:5_FioQvsVZr-oZXk3OhLaVaNXSywlj60RsBoXisX8vA` |
| Challenge key | 32 bytes, each `c1` |
| Record key | 32 bytes, each `d2` |
| Learner | `11111111-1111-4111-8111-111111111111` |
| Device | `22222222-2222-4222-8222-222222222222` |
| Check | `m1-p1`, `1.0.0`, sha256 = `ab` repeated 32 times |
| Issued at | `1794000000` (expires `1794000900`) |
| Nonce | `AAECAwQFBgcICQoLDA0ODxAREhMUFRYX` (bytes `00 01 … 17`) |
| `check_definitions.id` | `7` |

The key handling is also checked against RFC 8032, test 1: seed
`9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60` gives public key
`d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a`.

**Challenge** (canonical, one line):

```text
{"check":{"id":"m1-p1","sha256":"abababababababababababababababababababababababababababababababab","version":"1.0.0"},"device_id":"22222222-2222-4222-8222-222222222222","expires_at":1794000900,"issued_at":1794000000,"kind":"academy.challenge","nonce":"AAECAwQFBgcICQoLDA0ODxAREhMUFRYX","user_id":"11111111-1111-4111-8111-111111111111","v":1}
```

**Challenge stamp:** `L7_FGNlaqj_2nHslUWTAjjqap2RRgaRWUP3a0fShNrE`

**Payload** (canonical, one line, 928 bytes in UTF-8; it holds `—` and `é` on purpose):

```text
{"challenge":{"expires_at":1794000900,"nonce":"AAECAwQFBgcICQoLDA0ODxAREhMUFRYX"},"check":{"id":"m1-p1","sha256":"abababababababababababababababababababababababababababababababab","version":"1.0.0"},"checker_version":"0.1.0","commit":{"clean":true,"sha":"a1b2c3d"},"device_id":"22222222-2222-4222-8222-222222222222","finished_at":1794000009,"kind":"academy.check-result","passed":false,"results":{"steps":[{"id":"class-list","kind":"files","outcome":"pass","reasons":[],"required":true,"title":"The class list is in reports/term-1"},{"id":"backup-runs","kind":"tests","outcome":"fail","reasons":["Running ./scripts/backup.sh did not print exactly 'backup ok'."],"required":true,"title":"backup.sh prints \"backup ok\""},{"id":"answers","kind":"doc","outcome":"pass","reasons":[],"required":true,"title":"answers.md has the three headings — é"}]},"started_at":1794000005,"user_id":"11111111-1111-4111-8111-111111111111","v":1}
```

| Item | Value |
| :--- | :--- |
| SHA-256 of the payload | `0569d3458c317e448258bfebcdb0e87832c9cd41dd56932fd936b8dec268728a` |
| Signature by device A | `wyffKLd7hcv4ht6k0Zkd9xbo9uTRRD_9sNfu8fbxvXKVy3J_IAUzh13fBTWHfUjDUPtHitR1dBDvLFeSmHLcAA` |
| Record stamp | `602824d1042ff9dabf6aee743baa50de9eecebc08107dff4ea83ec7fba6dd37e` |

## 10. What must fail (all tested)

| Attempt | Result |
| :--- | :--- |
| One changed byte in the payload or the signature | `signature` |
| The same values with keys in another order, old signature | `signature` |
| Non-canonical text signed by the right device (other order, whitespace, duplicate key) | `payload_malformed` |
| Challenge used after `expires_at` | `challenge_expired` |
| Challenge with changed text, a longer life, or a stamp from another key | `challenge_stamp` |
| A result signed for another check, version or check hash | `mismatch_check` |
| A valid challenge used to record another check or version | `expected_check` |
| A result that answers another challenge | `mismatch_nonce` |
| Signature made by another device | `signature` |
| Another device answering as itself | `mismatch_device` / `expected_device` |
| A result naming another learner | `mismatch_user` / `expected_user` |
| The same challenge recorded twice | refused by the database (unique `nonce`) |

## 11. Changing the protocol

Any change to a rule above is a new version: new `v`, new context lines (`…/v2`), new vectors.
A v1 receiver refuses everything that is not `v: 1`.
