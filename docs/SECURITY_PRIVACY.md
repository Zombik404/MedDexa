# Security, privacy and regulatory notes

## Security controls

- **Authentication:** bcrypt (cost 12) password hashes; 15-minute JWT access tokens (issuer/audience checked); opaque 48-byte refresh tokens stored only as SHA-256 hashes; rotation on every refresh; reuse of a rotated token revokes all sessions of the user. Login timing is equalised for unknown emails. Password reset tokens are single-use, hashed and expire after 1 hour; a reset revokes all sessions. Forgot-password never reveals whether an account exists.
- **Authorisation:** global guard; routes public unless `@RequireAuth`/`@Roles`; roles USER, MODERATOR, EDITOR, ADMIN; admins cannot demote or suspend themselves; suspending a user revokes sessions.
- **Admin dashboard:** tokens only in `httpOnly`, `SameSite=Strict` cookies (`Secure` in production); same-origin proxy forwards only `/v1/*`; non-staff logins are rejected and their new session revoked; security headers (frame denial, nosniff, referrer and permissions policies); `noindex`.
- **Input validation:** Zod schemas shared with the clients on every body and query; SQL is built only with Prisma's parameterised `Prisma.sql`; the tsquery builder strips operators.
- **Rate limiting & abuse:** global per-IP limit, stricter auth/reset/review limits, daily review cap, automatic review pre-moderation, report-based hiding.
- **Transport:** HTTPS required in production (terminate TLS at the load balancer); `helmet` headers; CORS allow-list.
- **Logging:** structured pino logs with redaction of authorization headers, cookies, passwords and tokens; Sentry with `sendDefaultPii: false`.
- **Audit:** every administrative mutation is recorded with actor, before/after and IP.
- **Secrets:** only environment variables (EAS environment variables for mobile build secrets); nothing secret in the repository or in `DataSource.config`.
- **Mobile:** refresh token in iOS Keychain / Android Keystore via `expo-secure-store`; location is requested only "while in use", never persisted, and only sent as a search parameter.

## GDPR

| Principle | Implementation |
| --- | --- |
| Data minimisation | Guests need no account; analytics events contain no user id, IP or device id; reviews show first name + initial only |
| Lawful basis & consent | Account data under contract; push notifications and price alerts opt-in; search history can be switched off (and is deleted when switched off) |
| Right of access / portability (Art. 15, 20) | `GET /v1/me/export` — machine-readable JSON of all personal data (secrets excluded) |
| Right to erasure (Art. 17) | `POST /v1/me/delete` — deletes the account and cascades to preferences, sessions, favourites, histories, notifications, push tokens, votes, reports and reviews; an audit entry without personal data records the deletion |
| Storage limitation | Expired sessions/reset tokens can be purged; analytics are anonymous |
| Health data | MedDexa does not ask for diagnoses or prescriptions. Favourites and search history *can* reveal health information (Art. 9 special category); treat the personal-data tables as sensitive: encryption at rest, restricted DB access, DPIA before launch |
| Processors | Hosting, email (SMTP), Sentry, Expo push, Google Maps — list them in the privacy policy and sign DPAs |

## Regulatory considerations (to confirm with counsel per market)

- **Medicine advertising:** EU Directive 2001/83/EC (Title VIII) bans advertising prescription-only medicines to the public, with stricter national rules (e.g. Germany's HWG, Hungary's Act XCVIII of 2006). MedDexa shows neutral factual information, does not rank or promote products commercially, has no sponsored placement, and shows prescription status prominently. Any future partnership must preserve this.
- **Not a medical device / no diagnosis:** the app gives no dosing or treatment recommendations; the comparison engine never recommends substitution; disclaimers appear in onboarding, comparison, detail pages and the about screen. Adding symptom checking or personalised dosing would likely bring it under the Medical Device Regulation (EU) 2017/745.
- **No distance selling:** MedDexa does not sell or deliver medicines, so the EU common logo for online pharmacies (Art. 85c of Directive 2001/83/EC) does not apply. Converted prices are labelled as estimates and do not imply cross-border purchase.
- **Data licensing:** respect each provider's licence and attribution (docs/INTEGRATIONS.md). ODbL share-alike may apply to a publicly distributed pharmacy database derived from OSM.
- **Reviews:** EU consumer law (Omnibus Directive) requires informing users how reviews are checked — MedDexa does not claim "verified purchaser" status and describes its moderation instead.
- **Accessibility:** the European Accessibility Act applies to consumer apps from June 2025 — components expose roles, labels and states, support font scaling, and colour pairs were chosen for contrast; run a full WCAG 2.1 AA audit before launch.
