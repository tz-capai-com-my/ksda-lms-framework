const sentenceSegmenters = new Map<string, Intl.Segmenter>();

// Change presentation only: retain every source sentence, in its original order.
export function teachingPoints(paragraphs: readonly string[], locale: "en" | "ms"): string[] {
  if (typeof Intl.Segmenter !== "function") return paragraphs.map(text => text.trim()).filter(Boolean);
  let segmenter = sentenceSegmenters.get(locale);
  if (!segmenter) {
    segmenter = new Intl.Segmenter(locale, { granularity: "sentence" });
    sentenceSegmenters.set(locale, segmenter);
  }
  return paragraphs.flatMap(paragraph => Array.from(segmenter.segment(paragraph), item => item.segment.trim()).filter(Boolean));
}
