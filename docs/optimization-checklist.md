# TermDoor optimization acceptance

Implementation is complete only after local tests and deployed runtime checks.

- [x] Private static caching, large response compression, application lazy loading
- [x] Heartbeat, tunnel, and application health reported separately
- [x] Local application page: add, edit, disable, test
- [x] Server enforced viewer, operator, terminal permissions and revocation
- [x] Mobile keyboard, clipboard, rotation, touch and visible reconnect attempts
- [x] Version comparison, session aware restart/update, sanitized diagnostics
- [x] Application loading stages and retry actions
- [x] Unified center/application logout
- [ ] Desktop and mobile browser acceptance
- [ ] Production deployment and GitHub synchronization without private settings

## Evidence and limits

- `node --test test/*.test.js`: 21 tests pass, including viewer/operator WebSocket denial, permission changes/revocation, cross-account access, logout, local-only settings, invalid credentials, static cache policy and restart acknowledgement.
- Local service reports 0.16.0; actual application probe authenticates successfully without exposing the key.
- Production: both enrolled devices have a heartbeat and usable tunnel. A compressed AIMini chat-state response returned HTTP 200 (572650 decoded bytes, about 2.8 seconds in one measurement; network timing varies).
- Application management: browser edit, test, save and reset verified. Desktop and 390px layout checked. Real iOS/Android keyboard and clipboard behavior still require device acceptance.
- Existing AIMini page-specific state/workbench requests supply data lazily; gateway static caching and compression complement that behavior. Arbitrary third-party applications are not supported by this release.

## Stability follow-up (0.16.1)

- Added heartbeat/tunnel/application-specific error codes and actionable enrollment diagnostics.
- Added delayed WebSocket handshake revocation regression; password changes invalidate sessions and reject stale password verification results.
- Password minimum is 10 characters, matching the deployed policy and form.
- Roadmap and remaining acceptance work: [development plan](ROADMAP.zh-CN.md).

## Recovery follow-up (0.16.2)

- Candidate dependencies and JavaScript syntax are checked in a disposable worktree before updating the live checkout.
- Recovery checkpoint preserves previous commit and dependencies; explicit recovery refuses dirty or unrelated checkouts.
- Center snapshots have integrity checks, private permissions, and restore only into a new directory.
- Isolation tests cover install failure, syntax failure, successful update/recovery, dirty checkout protection and account/device restoration. Windows execution and automatic runtime-health rollback remain unverified or unimplemented.
