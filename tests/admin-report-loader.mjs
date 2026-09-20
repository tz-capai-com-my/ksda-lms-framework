export async function resolve(specifier, context, nextResolve) {
  if (specifier === "npm:@supabase/supabase-js@2.116.0") return nextResolve("@supabase/supabase-js", context);
  return nextResolve(specifier, context);
}
