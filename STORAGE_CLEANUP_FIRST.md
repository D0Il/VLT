# Storage status

The reset bucket can start empty. Use Storage -> Add Folder or Add Files for the first test upload.

Storage can be checked from the app:

1. Open the vault.
2. Choose a destination, then add one folder or a small set of files.
3. Watch upload progress.
4. Let Sync rebuild the index automatically.
5. Go to Storage and click Scan if you want to inspect the object paths.

The cleaner normalizes objects into:

- `Official/<Song>/...`
- `Demos/<Song>/...`
- `Official/<Song>/Instrumental/...`
- `Official/<Song>/Stems/...`
- `Beats/<Name>/...`
- `vault/state.json`

It treats `Superstar`, `Songs`, `song`, `official`, `Official`, `demos`, `Demos`, and `vault` as containers, not song names.

Stems, beats, instrumentals, visuals, and project files stay attached to the parent song entity.
