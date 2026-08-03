BACKSTAGE: DELETE PUBLISHED PRODUCTION

INSTALL
From the stevegregson-archive project root, run:

  ditto "$HOME/Downloads/backstage-delete-production-pack" .
  npx tsc --noEmit

TEST SAFELY
1. Use a disposable/test production, not a production you need to keep.
2. Open:
   http://localhost:3000/admin/edit-production/<test-production-slug>
3. Scroll below the Gallery to "Danger zone".
4. Click "Delete production".
5. Type DELETE exactly.
6. Click "Delete permanently".
7. Confirm you are redirected to /archive.
8. Confirm the production is absent from the archive and its public page returns 404.
9. Confirm these are gone:
   content/productions/<slug>.ts
   public/images/productions/<slug>/
10. Run:
   npx tsc --noEmit

COMMIT
  git add "app/admin/edit-production/[slug]/page.tsx" \
    app/api/admin/delete-production/route.ts \
    components/admin/editor/DeleteProductionPanel.tsx
  git commit -m "Add production deletion workflow"

NOTES
- Editing published productions remains handled by the existing production editor.
- Deletion removes the production file, its complete image folder, and its entry from content/productions/index.ts.
- The operation stages files first and attempts rollback if deletion fails.
