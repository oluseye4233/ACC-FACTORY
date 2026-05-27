# Sphinx Marketplace — Receiving end of the ATANDA → Sphinx integration

This is the **other half** of the "Upload SPC to Sphinx Marketplace" feature
that ships in ATANDA Command Centre. Drop this code into the
`ark-onecraft-sphinx` repo (adapt to its stack — TypeScript/Express examples
shown, port as needed).

The ATANDA side authenticates with a per-user bearer token of the form
`sphinx_live_<32 hex chars>` (regex on the ATANDA side: `^sphinx_(live|test)_[A-Za-z0-9]{16,}$`).
Generate exactly that shape.

---

## 1. DB table

```sql
CREATE TABLE sphinx_api_keys (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label         text,
  key_prefix    text NOT NULL,            -- first 16 chars verbatim, e.g. 'sphinx_live_a3f2'
  key_hash      text NOT NULL,            -- bcrypt(plaintext, 10)
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sphinx_api_keys_prefix_idx ON sphinx_api_keys (key_prefix);
```

We index by `key_prefix` (not `key_hash`) so lookups are O(1) — bcrypt is
intentionally slow, so we don't want to bcrypt-compare against every row.

## 2. Issue + revoke endpoints

```ts
// POST /api/me/api-keys  -> returns plaintext ONCE
router.post("/me/api-keys", requireAuth, async (req, res) => {
  const label = String(req.body?.label ?? "").slice(0, 80) || null;
  const raw = `sphinx_live_${randomBytes(16).toString("hex")}`; // 32 hex chars
  const prefix = raw.slice(0, 16);
  const hash = await bcrypt.hash(raw, 10);
  await db.insert(sphinxApiKeys).values({
    userId: req.user!.id,
    label,
    keyPrefix: prefix,
    keyHash: hash,
  });
  res.json({ apiKey: raw, prefix }); // <-- only time we ever return plaintext
});

// DELETE /api/me/api-keys/:id
router.delete("/me/api-keys/:id", requireAuth, async (req, res) => {
  await db
    .update(sphinxApiKeys)
    .set({ revokedAt: sql`now()` })
    .where(and(eq(sphinxApiKeys.id, req.params.id), eq(sphinxApiKeys.userId, req.user!.id)));
  res.status(204).end();
});
```

## 3. Bearer-auth middleware

```ts
export async function requireApiKey(req, res, next) {
  const header = req.header("authorization") ?? "";
  const m = /^Bearer (sphinx_(?:live|test)_[A-Za-z0-9]{16,})$/.exec(header);
  if (!m) return res.status(401).json({ error: "Missing or malformed bearer token" });
  const raw = m[1];
  const prefix = raw.slice(0, 16);

  const rows = await db
    .select()
    .from(sphinxApiKeys)
    .where(and(eq(sphinxApiKeys.keyPrefix, prefix), isNull(sphinxApiKeys.revokedAt)));

  for (const r of rows) {
    if (await bcrypt.compare(raw, r.keyHash)) {
      req.apiKeyUserId = r.userId;
      // fire-and-forget; never block the publish on a stats update
      void db.update(sphinxApiKeys).set({ lastUsedAt: sql`now()` }).where(eq(sphinxApiKeys.id, r.id));
      return next();
    }
  }
  return res.status(401).json({ error: "Invalid or revoked API key" });
}
```

## 4. The publish endpoint

```ts
const PublishBody = z.object({
  source: z.literal("atanda-command-centre"),
  externalId: z.string().uuid(),       // ATANDA artifact.id
  title: z.string().min(1).max(300),
  spcKind: z.literal("F5_FULL_SPC"),
  spcMarkdown: z.string().min(1),
  spcStructured: z.record(z.unknown()), // raw artifactContent
  jcseScore: z.number().int().nullable(),
  certTier: z.string().nullable(),
  spartanCert: z.record(z.unknown()).nullable(),
  verificationUrl: z.string().url().nullable(),
  license: z.string().max(40),
  visibility: z.enum(["public", "unlisted"]),
  author: z.object({
    id: z.string().uuid(),
    name: z.string().nullable(),
    email: z.string().email().nullable(),
  }),
});

router.post("/marketplace/listings", requireApiKey, async (req, res) => {
  const parsed = PublishBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const b = parsed.data;

  // Idempotency: same (source, externalId, apiKeyUser) updates rather than duplicates.
  const existing = await db
    .select()
    .from(marketplaceListings)
    .where(
      and(
        eq(marketplaceListings.source, b.source),
        eq(marketplaceListings.externalId, b.externalId),
        eq(marketplaceListings.ownerUserId, req.apiKeyUserId!),
      ),
    )
    .limit(1);

  const fields = {
    ownerUserId: req.apiKeyUserId!,
    source: b.source,
    externalId: b.externalId,
    title: b.title,
    spcKind: b.spcKind,
    spcMarkdown: b.spcMarkdown,
    spcStructured: b.spcStructured,
    jcseScore: b.jcseScore,
    certTier: b.certTier,
    spartanCert: b.spartanCert,
    verificationUrl: b.verificationUrl,
    license: b.license,
    visibility: b.visibility,
    authorName: b.author.name,
    authorEmail: b.author.email,
    publishedAt: sql`now()`,
  };

  let listingId: string;
  if (existing[0]) {
    listingId = existing[0].id;
    await db.update(marketplaceListings).set(fields).where(eq(marketplaceListings.id, listingId));
  } else {
    const [row] = await db
      .insert(marketplaceListings)
      .values(fields)
      .returning({ id: marketplaceListings.id });
    listingId = row!.id;
  }

  res.json({
    listingId,
    listingUrl: `${process.env.PUBLIC_BASE_URL}/marketplace/${listingId}`,
  });
});
```

## 5. UI plumbing (Sphinx side)

- Add a "Personal API keys" card in the Sphinx user settings page that calls
  `POST /api/me/api-keys` and surfaces the plaintext value **once** with a
  big "COPY" button + warning that it won't be shown again.
- Add a "Source" badge on listing detail pages showing `from atanda-command-centre`
  when `source !== "sphinx-native"`.

## 6. Env

On ATANDA side, set `SPHINX_BASE_URL=https://sphinx.ark.onecraft` (or your dev URL).
ATANDA's publish endpoint is `${SPHINX_BASE_URL}/api/marketplace/listings`.

## 7. Smoke test

```bash
# 1. issue a key in Sphinx UI, copy plaintext to clipboard
# 2. paste into ATANDA Account → Connected Services → Sphinx
# 3. on any session-detail page with an F5 SPC artifact, click "UPLOAD TO SPHINX"
# 4. expect a toast with the listing URL; button flips to "View on Sphinx"
# 5. open the listing URL — should render the SPC + a "verified by ATANDA" link
```
