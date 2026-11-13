// Cloudflare Pages Function: POST /api/contact. Kept so a Pages deploy behaves like the Worker
// deploy (src/worker.ts); both run the same core in src/lib/contact.ts.
import { handleContact, type ContactEnv } from "../../src/lib/contact";

export const onRequest: PagesFunction<ContactEnv> = ({ request, env }) => handleContact(request, env);
