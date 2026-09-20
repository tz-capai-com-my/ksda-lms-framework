import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;
const sectionKinds = new Set(["knowledge", "practice", "action", "review", "safety"]);
const reviewStates = new Set(["REVIEW", "APPROVED"]);

// Pure validation: never normalise, reorder, translate, or remove a review gate.
// The three manifests form one course contract, including the stored topic order.
export function validateContent({ catalogue, summaries, details }) {
  const errors = [];
  const fail = (path, message) => errors.push(`${path}: ${message}`);
  const object = (value, path) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) { fail(path, "must be an object"); return {}; }
    return value;
  };
  const array = (value, path, minimum = 1) => {
    if (!Array.isArray(value)) { fail(path, "must be an array"); return []; }
    if (value.length < minimum) fail(path, `must contain at least ${minimum} item(s)`);
    return value;
  };
  const text = (value, path, pattern) => {
    if (typeof value !== "string" || !value.trim()) { fail(path, "must be a nonempty string"); return; }
    if (pattern && !pattern.test(value)) fail(path, "has an invalid identifier format");
  };
  const unique = (values, path) => {
    const seen = new Set();
    for (const value of values) {
      if (seen.has(value)) fail(path, `duplicate identifier ${JSON.stringify(value)}`);
      seen.add(value);
    }
  };
  const strings = (value, path, minimum = 1) => {
    const values = array(value, path, minimum);
    values.forEach((item, index) => text(item, `${path}[${index}]`));
    return values;
  };
  const bilingual = (value, field, path, minimum = 1) => {
    const en = strings(value[field], `${path}.${field}`, minimum);
    const ms = strings(value[`${field}Ms`], `${path}.${field}Ms`, minimum);
    if (en.length !== ms.length) fail(path, `${field}/${field}Ms must have matching counts`);
  };
  const url = (value, path) => {
    if (typeof value !== "string" || !value.trim() || value !== value.trim()) { fail(path, "must be an HTTPS URL or a local absolute path"); return; }
    let decoded;
    try { decoded = decodeURIComponent(value); } catch { fail(path, "contains invalid URL encoding"); return; }
    if (/\s/.test(value) || /[\\\u0000-\u001f\u007f]/.test(decoded) || decoded.split(/[/?#]/).includes("..")) {
      fail(path, "must not contain traversal, backslashes, whitespace or control characters"); return;
    }
    if (value.startsWith("/") && !decoded.startsWith("//")) return;
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) throw new Error();
    } catch { fail(path, "must be an HTTPS URL or a local absolute path, without credentials"); }
  };
  const pages = (value, path, maximum) => {
    for (const page of array(value, path, 0)) {
      if (!Number.isInteger(page) || page < 1 || (maximum !== undefined && page > maximum)) fail(path, "must contain valid positive source page numbers");
    }
  };
  const checkReview = (value, path, section = false) => {
    if (value.reviewState !== undefined && (!section || !reviewStates.has(value.reviewState))) {
      fail(`${path}.reviewState`, section ? "must be REVIEW or APPROVED" : "review gates belong on sections; course/topic gates are not supported");
    }
    if (value.translationReviewRequired !== undefined && typeof value.translationReviewRequired !== "boolean") fail(`${path}.translationReviewRequired`, "must be a boolean");
  };
  const courseList = (value, path) => {
    const rows = array(value, path).map((item, index) => object(item, `${path}[${index}]`));
    rows.forEach((item, index) => text(item.slug, `${path}[${index}].slug`, slugPattern));
    unique(rows.map(item => item.slug), `${path}.slug`);
    return rows;
  };
  const publicCourses = courseList(catalogue, "catalogue");
  const summaryCourses = courseList(summaries, "summaries");
  const detailedCourses = courseList(details, "details");
  const slugs = publicCourses.map(course => course.slug).sort();
  for (const [name, courses] of [["summaries", summaryCourses], ["details", detailedCourses]]) {
    if (JSON.stringify(courses.map(course => course.slug).sort()) !== JSON.stringify(slugs)) fail(name, "course slugs must match the catalogue exactly");
  }
  unique(publicCourses.map(course => course.databaseSlug), "catalogue.databaseSlug");
  unique(publicCourses.map(course => course.number), "catalogue.number");
  for (const [index, course] of publicCourses.entries()) {
    const path = `catalogue[${index}]`;
    text(course.databaseSlug, `${path}.databaseSlug`, slugPattern);
    for (const field of ["number", "title", "titleMs", "outcome", "outcomeMs", "style", "styleMs", "duration", "durationMs"]) text(course[field], `${path}.${field}`);
    if (!Number.isSafeInteger(course.missions) || course.missions < 1) fail(`${path}.missions`, "must be a positive integer");
    if (publicCourses.some(other => other !== course && other.slug === course.databaseSlug)) fail(`${path}.databaseSlug`, "must not shadow another course's public slug");
    if (course.image) { url(course.image, `${path}.image`); text(course.alt, `${path}.alt`); }
    else if (course.image !== undefined && typeof course.image !== "string") fail(`${path}.image`, "must be a string when supplied");
  }
  let topicCount = 0, sectionCount = 0;
  for (const [courseIndex, course] of summaryCourses.entries()) {
    const path = `summaries[${courseIndex}]`;
    text(course.title, `${path}.title`); text(course.titleMs, `${path}.titleMs`); checkReview(course, path);
    const topics = array(course.topics, `${path}.topics`).map((topic, index) => object(topic, `${path}.topics[${index}]`));
    unique(topics.map(topic => topic.id), `${path}.topics.id`);
    const configured = publicCourses.find(item => item.slug === course.slug);
    if (configured && configured.missions !== topics.length) fail(`${path}.topics`, "topic count must equal catalogue missions");
    const detailed = detailedCourses.find(item => item.slug === course.slug);
    if (detailed && (!Array.isArray(detailed.topics) || JSON.stringify(detailed.topics.map(item => item?.id)) !== JSON.stringify(topics.map(item => item.id)))) fail(`${path}.topics`, "topic IDs and order must match detailed topics exactly");
    for (const [index, topic] of topics.entries()) {
      topicCount++;
      const p = `${path}.topics[${index}]`;
      text(topic.id, `${p}.id`, idPattern); text(topic.title, `${p}.title`); text(topic.titleMs, `${p}.titleMs`); checkReview(topic, p);
      bilingual(topic, "notes", p);
      text(topic.notesPrompt, `${p}.notesPrompt`); text(topic.notesPromptMs, `${p}.notesPromptMs`);
      if (topic.videoUrl !== null && topic.videoUrl !== undefined && topic.videoUrl !== "") url(topic.videoUrl, `${p}.videoUrl`);
      const questions = array(topic.questions, `${p}.questions`).map((q, n) => object(q, `${p}.questions[${n}]`));
      unique(questions.map(q => q.id), `${p}.questions.id`);
      for (const [n, question] of questions.entries()) {
        const qp = `${p}.questions[${n}]`;
        text(question.id, `${qp}.id`, idPattern);
        for (const field of ["prompt", "promptMs", "feedback", "feedbackMs"]) text(question[field], `${qp}.${field}`);
        bilingual(question, "options", qp, 2);
      }
    }
  }
  for (const [courseIndex, course] of detailedCourses.entries()) {
    const path = `details[${courseIndex}]`;
    checkReview(course, path);
    if (course.sourcePageCount !== undefined && (!Number.isSafeInteger(course.sourcePageCount) || course.sourcePageCount < 1)) fail(`${path}.sourcePageCount`, "must be a positive integer");
    const topics = array(course.topics, `${path}.topics`).map((topic, index) => object(topic, `${path}.topics[${index}]`));
    unique(topics.map(topic => topic.id), `${path}.topics.id`);
    const sectionIds = [];
    for (const [index, topic] of topics.entries()) {
      const p = `${path}.topics[${index}]`;
      text(topic.id, `${p}.id`, idPattern); checkReview(topic, p);
      if (topic.sourcePages !== undefined) pages(topic.sourcePages, `${p}.sourcePages`, course.sourcePageCount);
      const sections = array(topic.sections, `${p}.sections`).map((section, n) => object(section, `${p}.sections[${n}]`));
      for (const [n, section] of sections.entries()) {
        sectionCount++;
        const sp = `${p}.sections[${n}]`;
        text(section.id, `${sp}.id`, idPattern); sectionIds.push(section.id);
        text(section.title, `${sp}.title`); text(section.titleMs, `${sp}.titleMs`);
        if (!sectionKinds.has(section.kind)) fail(`${sp}.kind`, "must be a supported teaching section kind");
        checkReview(section, sp, true);
        bilingual(section, "body", sp);
        pages(section.sourcePages, `${sp}.sourcePages`, course.sourcePageCount);
        if (section.primaryReferences !== undefined) array(section.primaryReferences, `${sp}.primaryReferences`, 0).forEach((reference, i) => url(reference, `${sp}.primaryReferences[${i}]`));
      }
    }
    unique(sectionIds, `${path}.sections.id`);
  }
  if (errors.length) throw new Error(`CONTENT_INVALID\n${errors.map(error => `- ${error}`).join("\n")}`);
  return { courses: publicCourses.length, topics: topicCount, sections: sectionCount };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const paths = ["../config/course-catalogue.json", "../content/ksda/free-topics.json", "../content/ksda/course-details.json"];
    const [catalogue, summaries, details] = await Promise.all(paths.map(async path => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"))));
    const counts = validateContent({ catalogue, summaries, details });
    console.log(`Content validated: ${counts.courses} courses, ${counts.topics} topics, ${counts.sections} sections.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
