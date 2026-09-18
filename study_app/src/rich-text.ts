export type RichTextToken =
  | { type: "text" | "code"; text: string }
  | { type: "link"; text: string; href: string };

function isHttpUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value) || /[\s<>"'`\\]/.test(value)) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && !!url.hostname;
  } catch {
    return false;
  }
}

function trimBareUrl(value: string): string {
  let end = value.length;
  while (end) {
    const last = value[end - 1];
    if (/[.,;:!?]/.test(last)) { end--; continue; }
    const open = ({ ")": "(", "]": "[", "}": "{" } as Record<string, string>)[last];
    if (!open) break;
    const candidate = value.slice(0, end);
    if (candidate.split(last).length <= candidate.split(open).length) break;
    end--;
  }
  return value.slice(0, end);
}

/** A deliberately small inline format: HTTP(S) links and code, never HTML. */
export function tokenizeRichText(value: string): RichTextToken[] {
  const tokens: RichTextToken[] = [];
  function text(part: string) {
    if (!part) return;
    const previous = tokens.at(-1);
    if (previous?.type === "text") previous.text += part;
    else tokens.push({ type: "text", text: part });
  }

  for (let i = 0; i < value.length;) {
    const rest = value.slice(i);
    if (rest[0] === "`") {
      const delimiter = rest.match(/^`+/)![0];
      const lineEnd = value.indexOf("\n", i);
      const limit = lineEnd === -1 ? value.length : lineEnd;
      let close = value.indexOf(delimiter, i + delimiter.length);
      while (close !== -1 && close < limit &&
        (value[close - 1] === "`" || value[close + delimiter.length] === "`")) {
        close = value.indexOf(delimiter, close + delimiter.length);
      }
      const end = close !== -1 && close < limit ? close + delimiter.length : limit;
      if (delimiter.length <= 2 && close > i + delimiter.length && close < limit) {
        tokens.push({ type: "code", text: value.slice(i + delimiter.length, close) });
      } else text(value.slice(i, end));
      i = end;
      continue;
    }

    // Keep unsupported HTML, including attribute URLs, as literal text.
    const html = rest.match(/^<([a-zA-Z][\w:-]*)\b[^<>]*>[\s\S]*?<\/\1\s*>/i)
      ?? rest.match(/^<(?:!--[\s\S]*?--|\/?[a-zA-Z][^<>]*)>/);
    if (html) {
      text(html[0]);
      i += html[0].length;
      continue;
    }

    const label = rest.match(/^(!?)\[([^\[\]\n]*)\]\(/);
    if (label) {
      const start = i + label[0].length;
      let end = start;
      let depth = 1;
      while (end < value.length && value[end] !== "\n" && depth) {
        if (value[end] === "(") depth++;
        if (value[end] === ")") depth--;
        end++;
      }
      const href = value.slice(start, end - 1);
      if (!depth && !label[1] && label[2] && isHttpUrl(href)) {
        tokens.push({ type: "link", text: label[2], href });
      } else text(value.slice(i, end));
      i = end;
      continue;
    }

    const bare = rest.match(/^https?:\/\/[^\s<>"'`]+/i);
    if (bare && (i === 0 || !/[\w]/.test(value[i - 1]))) {
      const href = trimBareUrl(bare[0]);
      if (isHttpUrl(href)) {
        tokens.push({ type: "link", text: href, href });
        i += href.length;
        continue;
      }
    }
    text(value[i]);
    i++;
  }
  return tokens;
}
