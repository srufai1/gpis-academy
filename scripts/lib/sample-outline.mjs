/** A small offline course outline for tests (two modules with units, one empty). */
export const OUTLINE = [
  { slug: "m1", number: 1, label: "1", title: "Command line, Git and how the web works", guidanceLabel: "Guided", weeks: 6, units: [
    { id: "m1-u1", label: "1.1", title: "The terminal and the filesystem", quizId: "m1-u1-quiz", projectId: "m1-p1", projectTitle: "Find your way" },
    { id: "m1-u2", label: "1.2", title: "Streams and pipes", quizId: "m1-u2-quiz", projectId: "m1-p2", projectTitle: "Failure report" },
  ] },
  { slug: "m2", number: 2, label: "2", title: "JavaScript and TypeScript", guidanceLabel: "Guided", weeks: 8, units: [
    { id: "m2-u1", label: "2.1", title: "Values and types", quizId: "m2-u1-quiz", projectId: "m2-p1", projectTitle: "Grading" },
  ] },
  { slug: "m3", number: 3, label: "3", title: "Frontend with Next.js", guidanceLabel: "Guided → half", weeks: 8, units: [] },
];
