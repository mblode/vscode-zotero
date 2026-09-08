// Pandoc permits internal punctuation in keys. Whitespace and citation delimiters end a key.
const keyPattern = /[^\s[\]{}(),;\\@]+/gu;
export function selectedKey(selection: string): string | undefined {
  let text = selection.trim();
  const latex = /^\\[a-zA-Z]+\*?(?:\[[^\]]*\])*\{([^{}]+)\}$/.exec(text);
  if (latex) text = latex[1];
  else if (text.startsWith("[") && text.endsWith("]"))
    text = text.slice(1, -1).trim();
  text = text.replace(/^-?@/, "");
  return /^[^\s[\]{}(),;\\@]+$/u.test(text) ? text : undefined;
}
export function keyAtPosition(
  line: string,
  column: number,
): string | undefined {
  // Within a TeX command, only the comma-separated keys in the final braces qualify.
  for (const match of line.matchAll(
    /\\[a-zA-Z]+\*?(?:\[[^\]]*\])*\{([^{}]*)\}/g,
  )) {
    if (column >= match.index && column <= match.index + match[0].length) {
      const start = match.index + match[0].lastIndexOf("{") + 1;
      if (column < start || column > start + match[1].length) return undefined;
      return tokenAt(match[1], column - start);
    }
  }
  return tokenAt(line, column);
}
function tokenAt(text: string, column: number): string | undefined {
  for (const match of text.matchAll(keyPattern)) {
    const start = match.index;
    const marker = text[start - 1] === "@";
    if (match[0] === "-" && text[start + 1] === "@") continue;
    const prefix = marker ? (text[start - 2] === "-" ? 2 : 1) : 0;
    if (column >= start - prefix && column <= start + match[0].length) {
      // Trailing punctuation in prose belongs to the sentence, not the citation.
      return match[0].replace(/[.:!?]+$/, "") || undefined;
    }
  }
  return undefined;
}
