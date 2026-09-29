import { serverSetting } from "../learn/supabase/config";
import { brand } from "../../config/brand";

// Explicit server opt-in after installing and activating an independently owned release.
export function readingDeliveryEnabled() {
  return brand.features.readingCompanions && serverSetting("KSDA_READING_DELIVERY_ENABLED") === "true";
}
export const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "no-referrer",
  "Vary": "Cookie, Authorization",
  "X-Content-Type-Options": "nosniff",
};
