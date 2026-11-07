// delete-account: deletes the caller's account and every piece of their data (GDPR, right to
// erasure). All tables cascade from auth.users; progress photos are removed from Storage first.
// POST { confirm: "SUPPRIMER" } → 200 { deleted: true }
import { z } from 'zod';

import { adminClient } from '../_shared/auth.ts';
import { json } from '../_shared/cors.ts';
import { HttpError, userHandler } from '../_shared/http.ts';

const bodySchema = z.object({ confirm: z.literal('SUPPRIMER') });
const BUCKET = 'progress-photos';

Deno.serve(
  userHandler('delete-account', async ({ req, user }) => {
    if (!bodySchema.safeParse(await req.json().catch(() => null)).success) {
      throw new HttpError(400, 'bad_request', 'Confirmation manquante.');
    }
    const admin = adminClient();

    // Photos live under "<user_id>/<file>"; list page by page until the folder is empty.
    for (let page = 0; page < 50; page++) {
      const { data: files, error } = await admin.storage.from(BUCKET).list(user.id, { limit: 100 });
      if (error) throw error;
      if (!files.length) break;
      const { error: removeError } = await admin.storage
        .from(BUCKET)
        .remove(files.map((f) => `${user.id}/${f.name}`));
      if (removeError) throw removeError;
    }

    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
    console.log(`[delete-account] ${user.id}`);
    return json({ deleted: true });
  }),
);
