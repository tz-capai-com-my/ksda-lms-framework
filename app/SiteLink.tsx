import type { ComponentProps } from "react";

// Use native document navigation while the deployed framework's client router
// fails during Link clicks. Cookies, anchor targets, modifier keys and history
// retain browser behaviour; no prefetch or client-router interception is used.
export default function SiteLink(props: ComponentProps<"a">) {
  return <a {...props} />;
}
