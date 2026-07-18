# QA Test Run

## Release identity

- Candidate:
- Commit SHA:
- Backend image digest:
- Web image digest:
- Companion CI run:
- Environment:
- Tester:
- Started/finished:

## Preconditions

- [ ] Release manifest checksum verified
- [ ] Staging certification JSON attached
- [ ] Backup checksum recorded
- [ ] Test accounts contain no production data
- [ ] Provider quotas and failure controls confirmed

## Execution matrix

| Area | Scenario | Browser/OS | Result | Evidence | Defect |
| --- | --- | --- | --- | --- | --- |
| Authentication | Invalid/valid login, logout, expiry | | | | |
| Authorization | Customer cannot access admin APIs/UI | | | | |
| Chat | Text, image, long prompt, retry | | | | |
| Reliability | 429, 5xx, timeout, full outage, recovery | | | | |
| Idempotency | Double click and repeated request key | | | | |
| Models | Manual switch, attribution, selector consistency | | | | |
| Admin | CRUD, last-model protection, diagnostics | | | | |
| Companion | Pair, reconnect, workspace, offline | | | | |
| Responsive | Desktop, tablet, mobile, 200% zoom | | | | |
| Accessibility | Keyboard, focus, names, contrast | | | | |
| Operations | Alerts, backup/restore, rollback | | | | |

## Exit decision

- Open P0:
- Open P1:
- Known P2/P3 accepted by:
- QA decision: Pass / Fail / Conditional
- QA lead:
- Engineering owner:
- Product owner:
