# Bongómælir / bongo.andri.is

Credential-free static-first MVP for answering the important Icelandic question: **Hversu bongó er hjá þér?**

## v1 scope

- Local-first location selection using static/mock weather snapshots.
- Deterministic 0–100 Bongó score with Icelandic labels and explanations.
- Top-5 list for **Hvar er bongó?**.
- About/origin story: Andri's 14-year-old 3W solar-powered LED sign in the window.
- No accounts, no user reports, no uploads, no credentials, no external weather calls.

## Local development

```bash
npm install
npm test
npm run lint
npm run build
npm run dev
```

## Project location decision

This is a standalone app under `/root/workspace/github/AndriGitDev/bongo`, matching the deployment shape of `kreppa.andri.is` more than the main `andri-web` profile site. `andri-web` remains the canonical `andri.is` portfolio; Bongómælir is a subdomain experiment with its own scoring engine and static data boundary.
