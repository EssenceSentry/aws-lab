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
}

export function resolveOptionReferences(text: string, optionOrder: readonly string[]): string {
  return text.replace(/<<(\d+)>>/g, (_, id: string) => optionLabel(id, optionOrder));
}
