# Music Vault

Cloudflare Worker + R2 static app.

Build command:

```txt
npm run build
```

Deploy command:

```txt
npx wrangler deploy
```

Root directory:

```txt
/
```

R2 bucket binding:

```txt
VAULT_BUCKET -> song
```

Secret:

```txt
ADMIN_TOKEN
```

This build uses no React, no Vite, and no dependency install pile. The npm install step is intentionally empty so Cloudflare does not get stuck installing app packages.


## Import

Use Storage to import folders or individual files. The destination selector can read folder structure automatically or force new imports into Songs, Demos, or Standalone Instrumental. Uploads are normalized before they enter R2, so the bucket only receives canonical vault paths. Sync rebuilds the visible song index from R2 objects.
