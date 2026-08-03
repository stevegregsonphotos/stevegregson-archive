Gallery Editor rebuild

From the stevegregson-archive project root, after macOS unzips this folder into Downloads:

  ditto "$HOME/Downloads/gallery-editor-rebuild-pack" .
  npx tsc --noEmit

Test:
1. Open /admin/edit-production/a-role-to-die-for
2. Move a gallery image earlier and later.
3. Change an image layout.
4. Remove a gallery image.
5. Select a gallery image as the hero.
6. Click Save changes.
7. Refresh and confirm all changes persisted.

Commit after all tests pass:

  git add "app/admin/edit-production/[slug]/page.tsx" \
    app/api/admin/edit-production/route.ts \
    components/admin/editor/GalleryEditor.tsx \
    content/productions/a-role-to-die-for.ts
  git commit -m "Add gallery editing to production editor"
