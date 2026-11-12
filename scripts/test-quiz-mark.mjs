/** T09: quiz marking (pure). */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanAnswers, markQuiz } from "../apps/web/src/lib/quiz/mark.ts";

const quiz = JSON.parse(readFileSync(new URL("../content/module-01/unit-01/quiz.json", import.meta.url), "utf8"));
let checks = 0;
const eq = (a, b, label) => { assert.deepEqual(a, b, label); checks++; };
const all = (pick) => Object.fromEntries(quiz.questions.map((q) => [q.id, pick(q)]));

const perfect = markQuiz(quiz, all((q) => q.answer));
eq([perfect.score, perfect.total, perfect.passed], [quiz.questions.length, quiz.questions.length, true], "all right: full score, passed");
eq(perfect.questions[0].reason, quiz.questions[0].why, "a right answer shows why it is right");

const wrongFirst = { ...all((q) => q.answer), [quiz.questions[0].id]: (quiz.questions[0].answer + 1) % quiz.questions[0].options.length };
const one = markQuiz(quiz, wrongFirst);
eq(one.score, quiz.questions.length - 1, "one wrong: score drops by one");
eq(one.questions[0].reason, quiz.questions[0].wrong[String(wrongFirst[quiz.questions[0].id])], "a wrong answer shows the reason for that option");

const none = markQuiz(quiz, {});
eq([none.score, none.passed], [0, false], "nothing answered: zero, not passed");
assert.match(none.questions[0].reason, /^Not answered\./); checks++;

// Pass mark is inclusive.
const atMark = all((q) => q.answer);
quiz.questions.slice(quiz.pass_mark).forEach((q) => { delete atMark[q.id]; });
eq(markQuiz(quiz, atMark).passed, true, "exactly the pass mark passes");
const belowMark = { ...atMark };
delete belowMark[quiz.questions[0].id];
eq(markQuiz(quiz, belowMark).passed, false, "one below the pass mark does not");

// Only clean answers are kept.
eq(cleanAnswers(quiz, { [quiz.questions[0].id]: 0, zz: 1 }), { [quiz.questions[0].id]: 0 }, "unknown ids are dropped");
eq(cleanAnswers(quiz, { [quiz.questions[0].id]: 99 }), {}, "out-of-range answers are dropped");
eq(cleanAnswers(quiz, { [quiz.questions[0].id]: "1" }), {}, "text answers are dropped");
eq(cleanAnswers(quiz, null), {}, "no object, no answers");
eq(cleanAnswers(quiz, [1, 2]), {}, "a list is not answers");

// The browser gets the quiz only through publicQuiz(): no answers or reasons before marking.
const page = readFileSync(new URL("../apps/web/src/app/(app)/learn/[unit]/page.tsx", import.meta.url), "utf8");
const client = readFileSync(new URL("../apps/web/src/app/(app)/learn/[unit]/quiz.tsx", import.meta.url), "utf8");
assert.ok(page.includes("<Quiz quiz={publicQuiz(unit)}"), "the page passes the public quiz"); checks++;
assert.ok(!/lib\/content\/load|unit\.quiz/.test(client), "the quiz component never reads the full quiz"); checks++;

console.log(`Quiz marking: ${checks} checks passed.`);
