# Seeded NCE audio provenance

- File: `src/prisma/seeds/assets/README.md`
- Purpose: Document the source and integrity of deterministic NCE demo recordings.
- Why: Reviewers and operators should distinguish original fixtures from third-party media.

Both recordings are original synthetic demo assets created specifically for this repository on
2026-08-28. They contain only the short practice sentences already present in
`nceContent.data.ts`; no third-party recording or copyrighted audio file was copied.

- `dialogue.ogg.base64`: eSpeak NG `en-us`, 145 words/minute; SHA-256 `26c720066bd8894028aea742fc82cc64d58899e24e4179e0dd1f41df683edffd`.
- `dictation.ogg.base64`: eSpeak NG `en-us`, 135 words/minute; SHA-256 `571b6f9b47e24b79f0ae2dc32f03837670ec7299ce8e932f1ce2df165756f153`.
- Encoding: FFmpeg, mono 16 kHz Ogg Vorbis at quality 2, metadata removed.

The wrapped Base64 files are the canonical stored bytes. The demo seed verifies each hash before
creating a missing protected asset and never overwrites an existing configured asset.
