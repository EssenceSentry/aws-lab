/** IDs belong to the bank; labels belong to the session's saved permutation. */
export function optionLabel(id: string, optionOrder: readonly string[]): string {
  const index = optionOrder.indexOf(id);
  if (index < 0) throw new Error("Unknown option reference: " + id);
  return String.fromCharCode(65 + index);
}

export function validateOptionReferences(text: string, optionIds: readonly string[]) {
  const remaining = text.replace(/<<(\d+)>>/g, (_, id: string) => {
    if (!optionIds.includes(id)) throw new Error("Unknown option reference: " + id);
    return "";
  });
  if (remaining.includes("<<") || remaining.includes(">>")) throw new Error("Malformed option reference");

  // Lint explicit choice phrases; never guess replacements for arbitrary numbers.
  // Horizontal whitespace keeps numbered procedures after a heading out of the match.
  const item = String.raw`(?:(?:the[ \t]+)?(?:corrected|revised)[ \t]+)?(?:<<\d+>>|\d+\b)`;
  const list = item + String.raw`(?:[ \t]*(?:,[ \t]*(?:(?:and|or)[ \t]+)?|(?:and|or)[ \t]+)` + item + ")*";
  const phrases = new RegExp(
    String.raw`\b(?:options?|answers?|choices?)(?:[ \t]+|[ \t]*:[ \t]*)` + list +
    "|" + String.raw`\bSelect[ \t]+` + list + String.raw`(?=[.!?;](?:\s|$)|[ \t]+(?:is|are)\b)`, "gi",
  );
  for (const match of text.matchAll(phrases)) {
    if (/\d/.test(match[0].replace(/<<\d+>>/g, ""))) {
      throw new Error("Unmarked option reference: " + match[0] + ". Use <<id>> for each choice.");
    }
  }
}

export function resolveOptionReferences(text: string, optionOrder: readonly string[]): string {
  return text.replace(/<<(\d+)>>/g, (_, id: string) => optionLabel(id, optionOrder));
}
