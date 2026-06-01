---
name: Verify certificate identity names
description: Where the MVP product (SPC) name lives for the public /verify certificate, and why the parser must tolerate label variants
---

# SPARTAN /verify certificate — product vs session name

The public certificate page (`/verify?cert=...`) must identify *which* MVP is
certified. Two distinct identifiers are shown: **SPC NAME** (the product) and
**SESSION** (an internal session label).

## Where each name comes from
- **Session name** = `harness_sessions.session_name` (e.g. "THE FINANCE MAVEN").
  An internal label, often unrelated to the product.
- **SPC / product name** is NOT in `harness_artifacts.name` (almost always
  blank). It lives **inside the certified MVP PDD's `artifactContent`**, in the
  section with `key === "card_identity_metadata"`, as a markdown identity line.

## The non-obvious trap: the identity line label varies
Across model/provider outputs the line has appeared as both:
- `**Product:** RED PEN AI`
- `- **Product Name:** RED PEN AI`  (bulleted, "Product Name")

So any extractor must tolerate the optional " Name", optional leading bullet,
and same-line-only value capture. The regex used:
`/\*\*Product(?:\s+Name)?:\*\*[ \t]*(.+)/i` (then `.split("\n")[0].trim()`).

**Why:** a too-strict `**Product:**`-only match silently returned null for
half the certs, which then fell back to the session name — making every cert
look like it was named after its session.

## How to apply
- Keep `productName` and `sessionName` as **separate** response fields; never
  let productName fall back to sessionName (they must stay distinct so both can
  render). Fallback chain: extracted product → `artifact.name?.trim()` → null.
- If new cert samples show further label drift (extra spaces, different
  punctuation), widen the regex rather than adding section-specific hacks.
- Engine output Zod does not hard-enforce canonical section keys, so anchoring
  on `card_identity_metadata` depends on model compliance — acceptable today.
