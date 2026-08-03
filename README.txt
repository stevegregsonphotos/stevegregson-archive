BACKSTAGE PUBLISHER - COMMIT 1: PUBLISHING SETTINGS

Install from the project root:

  ditto "$HOME/Downloads/backstage-publisher-commit-1" .
  npx tsc --noEmit

Then restart the development server and open:

  http://localhost:3000/admin/settings

Test:
1. Find the Publishing section.
2. Change WebP quality or maximum image size.
3. Save publishing settings.
4. Refresh and confirm the values persist.
5. Confirm content/settings/publishing.json contains the saved values.

Commit:

  git add app/admin/settings/page.tsx \
    app/api/admin/publishing-settings/route.ts \
    components/admin/PublishingSettingsForm.tsx \
    content/settings/publishing.json \
    lib/publishing-settings.ts

  git commit -m "Add publishing settings"

This commit stores configuration only. It does not yet convert or publish images.
