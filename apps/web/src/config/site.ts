/**
 * The one place for the site name and fixed texts (AGENTS.md rule 3).
 * No other file types the site name.
 */
export const SITE = {
  name: "Ruftech Academy",
  description: "Learn software engineering by rebuilding a real system.",
  landing: {
    headline: "Learn software engineering by rebuilding a real system.",
    start: "Start learning",
    steps: [
      "Read a lesson",
      "Build it yourself",
      "Check it on your own computer",
      "Compare with the real GPIS",
    ],
    length: "9 modules · about 60 weeks",
    then: "Then: Python track · 8 weeks",
    courseMap: "See the course map",
    privacy: "Your code stays on your computer.",
  },
  nav: [
    { href: "/map", label: "Map" },
    { href: "/progress", label: "Progress" },
    { href: "/me", label: "Me" },
  ],
} as const;
