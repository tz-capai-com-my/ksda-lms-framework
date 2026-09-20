import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { teachingPoints } from "../app/learn/teaching-points.ts";
import { validateContent } from "../scripts/validate-content.mjs";

const readJson = async path => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const details = await readJson("../content/ksda/course-details.json");
const summaries = await readJson("../content/ksda/free-topics.json");
const catalogue = await readJson("../config/course-catalogue.json");
const manifests = { catalogue, summaries, details };
const normalise = text => text.replace(/\s+/g, " ").trim();

// These supplied examples contain gated operational material. Keeping an example
// must not silently expose a previously gated section. An approved release needs
// a deliberate baseline update. Replacing entire examples is allowed.
const exampleReviewGates = new Set([
  "fire-m05-detail-3", "m02-m02-detail-4", "m02-m03-detail-4",
  "m02-m04-detail-4", "m02-m05-detail-4",
]);

test("configured modules have aligned bilingual content, identifiers and topic order", () => {
  const before = structuredClone(manifests);
  const counts = validateContent(manifests);
  assert.equal(counts.courses, catalogue.length);
  assert.equal(counts.topics, summaries.reduce((sum, course) => sum + course.topics.length, 0));
  assert.deepEqual(manifests, before, "Validation must not rewrite text, metadata or review gates");
  for (const course of details) for (const topic of course.topics) for (const section of topic.sections) {
    if (exampleReviewGates.has(section.id)) assert.equal(section.reviewState, "REVIEW", section.id + " requires an explicit approved baseline update");
  }
});

function fictionalManifests() {
  const value = { catalogue: [], summaries: [], details: [] };
  for (let courseIndex = 1; courseIndex <= 2; courseIndex++) {
    const slug = `fixture-practice-${courseIndex}`;
    value.catalogue.push({ slug, databaseSlug: slug, number: String(courseIndex),
      title: "Practice", titleMs: "Latihan", outcome: "Consider an example.", outcomeMs: "Fikirkan satu contoh.",
      style: "Reflection", styleMs: "Refleksi", duration: "Self-paced", durationMs: "Mengikut kadar sendiri", missions: 2, image: "", alt: "" });
    const summary = { slug, title: "Practice", titleMs: "Latihan", topics: [] };
    const detailed = { slug, topics: [] };
    for (let topicIndex = 1; topicIndex <= 2; topicIndex++) {
      const id = `${slug}-topic-${topicIndex}`;
      summary.topics.push({ id, title: "Consider", titleMs: "Fikirkan", notes: ["Use a fictional example."], notesMs: ["Gunakan contoh rekaan."],
        notesPrompt: "What did you notice?", notesPromptMs: "Apakah yang anda perhatikan?", videoUrl: "/videos/practice.mp4",
        questions: [1, 2].map(index => ({ id: `${id}-question-${index}`, prompt: "What would you consider?", promptMs: "Apakah yang anda akan pertimbangkan?",
          options: ["Time", "Place"], optionsMs: ["Masa", "Tempat"], feedback: "Consider your choice.", feedbackMs: "Fikirkan pilihan anda." })),
      });
      detailed.topics.push({ id, sections: [1, 2].map(index => ({ id: `${id}-section-${index}`, kind: "review", reviewState: "REVIEW",
        title: "Reflect", titleMs: "Buat refleksi", body: ["Consider this example."], bodyMs: ["Fikirkan contoh ini."], sourcePages: [] })) });
    }
    value.summaries.push(summary); value.details.push(detailed);
  }
  return value;
}

test("an additional fictional module and a wholly replaced catalogue need no count or text-hash updates", () => {
  const expanded = structuredClone(manifests);
  const fixture = fictionalManifests();
  // Pick unused fixture identifiers even if a deployment adopted these examples.
  let suffix = 1;
  while (expanded.catalogue.some(course => course.slug === `new-fixture-${suffix}` || course.databaseSlug === `new-fixture-${suffix}`)) suffix++;
  for (const name of ["catalogue", "summaries", "details"]) {
    const added = fixture[name][0]; added.slug = `new-fixture-${suffix}`;
    if (name === "catalogue") {
      added.databaseSlug = added.slug;
      let number = 1;
      while (expanded.catalogue.some(course => course.number === String(number))) number++;
      added.number = String(number);
    }
    expanded[name].push(added);
  }
  assert.equal(validateContent(expanded).courses, catalogue.length + 1);
  assert.equal(expanded.details.at(-1).topics[0].sections[0].reviewState, "REVIEW");
  assert.deepEqual(validateContent(fictionalManifests()), { courses: 2, topics: 4, sections: 8 });
});

test("invalid identifiers, bilingual omissions, counts and reordered topics fail validation", () => {
  const cases = [
    ["duplicate course", value => value.catalogue.push(structuredClone(value.catalogue[0]))],
    ["duplicate database slug", value => { value.catalogue[1].databaseSlug = value.catalogue[0].databaseSlug; }],
    ["ambiguous slug alias", value => { value.catalogue[0].databaseSlug = value.catalogue[1].slug; }],
    ["missing course", value => value.details.pop()],
    ["zero topics", value => { value.summaries[0].topics = []; }],
    ["wrong mission count", value => value.catalogue[0].missions++],
    ["duplicate topic", value => { value.summaries[0].topics[1].id = value.summaries[0].topics[0].id; }],
    ["topic order changed", value => value.details[0].topics.reverse()],
    ["missing translation", value => { value.details[0].topics[0].sections[0].bodyMs = []; }],
    ["blank title", value => { value.catalogue[0].titleMs = " "; }],
    ["mismatched options", value => value.summaries[0].topics[0].questions[0].optionsMs.pop()],
    ["duplicate question", value => { value.summaries[0].topics[0].questions[1].id = value.summaries[0].topics[0].questions[0].id; }],
    ["duplicate section", value => { value.details[0].topics[0].sections[1].id = value.details[0].topics[0].sections[0].id; }],
    ["unsupported review state", value => { value.details[0].topics[0].sections[0].reviewState = "DRAFT"; }],
    ["ignored topic gate", value => { value.details[0].topics[0].reviewState = "REVIEW"; }],
    ["invalid source page", value => { value.details[0].topics[0].sections[0].sourcePages = [-1]; }],
  ];
  for (const [name, change] of cases) {
    const value = fictionalManifests(); change(value);
    assert.throws(() => validateContent(value), /CONTENT_INVALID/, name);
  }
});

test("media and source links accept HTTPS/local paths and reject executable, traversal or credential URLs", () => {
  for (const link of ["/videos/example.mp4", "/videos/my%20video.mp4", "https://media.example.invalid/video.mp4?version=2"]) {
    const value = fictionalManifests();
    value.summaries[0].topics[0].videoUrl = link;
    assert.doesNotThrow(() => validateContent(value));
  }
  for (const link of ["javascript:alert(1)", "data:video/mp4;base64,AAAA", "http://example.invalid/video.mp4", "//example.invalid/video.mp4", "../video.mp4", "/videos/../private.mp4", "/videos/%2e%2e/private.mp4", "/%2f%2fevil.invalid/video.mp4", "https://user:password@example.invalid/video.mp4", "https://example.invalid/../video.mp4", "https://example.invalid/%0avideo.mp4"]) {
    const value = fictionalManifests();
    value.summaries[0].topics[0].videoUrl = link;
    assert.throws(() => validateContent(value), /CONTENT_INVALID/, link);
    value.summaries[0].topics[0].videoUrl = null;
    value.details[0].topics[0].sections[0].primaryReferences = [link];
    assert.throws(() => validateContent(value), /CONTENT_INVALID/, "source reference: " + link);
  }
});

test("teaching bullets preserve every English and BM sentence in order", () => {
  for (const course of details) for (const topic of course.topics) for (const section of topic.sections) {
    for (const [locale, paragraphs] of [["en", section.body], ["ms", section.bodyMs]]) {
      const points = teachingPoints(paragraphs, locale);
      assert.ok(points.length >= paragraphs.length, section.id);
      assert.equal(normalise(points.join(" ")), normalise(paragraphs.join(" ")), section.id + " " + locale);
    }
  }
  // Decimal depths, emergency numbers and ratios remain whole when sentence boundaries change layout.
  const text = "Use the 5.5 cm example. Call 999. The ratio is 30:2.";
  assert.deepEqual(teachingPoints([text], "en"), ["Use the 5.5 cm example.", "Call 999.", "The ratio is 30:2."]);
  assert.deepEqual(teachingPoints(["Gunakan contoh 5.5 cm. Hubungi 999. Nisbahnya ialah 30:2."], "ms"), ["Gunakan contoh 5.5 cm.", "Hubungi 999.", "Nisbahnya ialah 30:2."]);
  assert.deepEqual(teachingPoints(["Use R.A.C.E. as the source framework. Keep the order."], "en"), ["Use R.A.C.E. as the source framework.", "Keep the order."]);
  assert.deepEqual(teachingPoints(["Gunakan R.A.C.E. sebagai rangka kerja sumber. Kekalkan urutannya."], "ms"), ["Gunakan R.A.C.E. sebagai rangka kerja sumber.", "Kekalkan urutannya."]);
});

test("shipped learning UI hydrates server bullet arrays without browser sentence segmentation", async () => {
  const clientRoot = new URL("../dist/client/", import.meta.url);
  const files = (await readdir(clientRoot, { recursive: true })).filter(name => /\.(?:js|mjs|cjs)$/.test(name));
  assert.ok(files.length > 0, "Build the client before checking its shipped modules");
  const modules = await Promise.all(files.map(async name => ({ name, text: await readFile(new URL(name, clientRoot), "utf8") })));
  assert.ok(modules.some(chunk => chunk.text.includes("ksda-teaching-points")), "The build must include the learning reading UI");
  // Scan shared chunks too: moving the helper into a dependency must not hide it.
  // Older browsers must render the serialized arrays, not derive different <li> boundaries.
  for (const chunk of modules) {
    assert.doesNotMatch(chunk.text, /\bSegmenter\b/, `${chunk.name}: sentence segmentation belongs on the server`);
  }
});
