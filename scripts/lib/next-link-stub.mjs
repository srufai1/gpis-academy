// Test-only stand-in for next/link: a plain anchor (no router in a static render).
import { createElement } from "react";
export default function Link({ href, children, prefetch: _prefetch, ...rest }) {
  void _prefetch;
  return createElement("a", { href: typeof href === "string" ? href : String(href), ...rest }, children);
}
