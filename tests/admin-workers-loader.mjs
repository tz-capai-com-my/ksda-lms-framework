// Isolated offline worker bindings for admin authentication/reporting fixtures.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "cloudflare:workers") return {
    url: "data:text/javascript,export const env = new Proxy({}, { get: (_, key) => globalThis.adminTestBindings?.[key] });",
    shortCircuit: true,
  };
  return nextResolve(specifier, context);
}
