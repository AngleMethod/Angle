import { createClient, SupabaseClient, User } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Look up a Supabase auth user by email. Paginates through every page so
// users beyond the first 50/1000 are still found, and lowercases on both
// sides so casing differences between Stripe / Calendly / manual entry
// don't cause silent misses.
export async function findUserByEmail(
  admin: SupabaseClient,
  email: string
): Promise<User | null> {
  const target = email.trim().toLowerCase();
  if (!target) return null;

  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users) return null;

    const found = data.users.find((u) => u.email?.toLowerCase() === target);
    if (found) return found;

    if (data.users.length < perPage) return null;
  }
}