import { Marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { decodeHTML } from "entities";

const markdown = new Marked({ gfm: true });
const plain = (html) => decodeHTML(sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })).replace(/\s+/g, " ").trim();

/** Compile the two authoring documents into a validated, offline navigation graph. */
export function prepareGuide(guideSource, indexSource, bank) {
  const headings = [...guideSource.matchAll(/^<a id="([\w-]+)"><\/a>\s*\n## (.+)$/gm)];
  if (!headings.length) throw new Error("The guide has no anchored sections");
  const anchorOwners = new Map();
  const sections = headings.map((heading, i) => {
    const body = guideSource.slice(heading.index + heading[0].length, headings[i + 1]?.index ?? guideSource.length);
    const anchors = [heading[1], ...[...body.matchAll(/<a id="([\w-]+)"><\/a>/g)].map((m) => m[1])];
    for (const anchor of anchors) {
      if (anchorOwners.has(anchor)) throw new Error("Duplicate guide anchor: " + anchor);
      anchorOwners.set(anchor, heading[1]);
    }
    return { id: heading[1], title: heading[2].replace(/^\d+\. /, ""), body, anchors, questionIds: [] };
  });
  function render(source) {
    return sanitizeHtml(markdown.parse(source), {
      allowedTags: ["p", "strong", "em", "code", "pre", "ul", "ol", "li", "blockquote", "h2", "h3", "h4", "table", "thead", "tbody", "tr", "th", "td", "a", "hr", "br"],
      allowedAttributes: { a: ["href", "id", "target", "rel"], th: ["scope"] },
      allowedSchemes: ["https", "http"],
      transformTags: {
        h3: "h2",
        th: () => ({ tagName: "th", attribs: { scope: "col" } }),
        a: (_tag, attributes) => {
          const attribs = {};
          if (attributes.id && anchorOwners.has(attributes.id)) attribs.id = "guide-" + attributes.id;
          const href = attributes.href ?? "";
          if (href === "aws_question_index.md") attribs.href = "#guide/questions";
          else if (href === "aws_service_decision_guide.md") attribs.href = "#guide";
          else if (href.startsWith("#") || href.startsWith("aws_service_decision_guide.md#")) {
            const anchor = href.slice(href.indexOf("#") + 1);
            if (!anchorOwners.has(anchor)) throw new Error("Broken guide link: " + href);
            attribs.href = "#guide/" + anchor;
          } else if (/^https?:\/\//.test(href)) Object.assign(attribs, { href, target: "_blank", rel: "noopener noreferrer" });
          return { tagName: "a", attribs };
        },
      },
    }).replace(/<table>[\s\S]*?<\/table>/g, (table) => {
      const labels = [...table.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)].map((m) => plain(m[1]).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;"));
      return table.replace(/<tr>([\s\S]*?)<\/tr>/g, (row) => {
        let column = 0;
        return row.replace(/<td>/g, () => '<td data-label="' + (labels[column++] ?? "") + '">');
      });
    }).replace(/<table>/g, '<div class="guide-table" role="region" aria-label="Service comparison" tabindex="0"><table>').replace(/<\/table>/g, "</table></div>");
  }
  const lookup = new Map(bank.map((q) => [q.id, q]));
  for (const match of guideSource.matchAll(/\bQ(\d+)\b/g)) {
    if (!lookup.has(match[1])) throw new Error("Unknown question reference in guide: " + match[0]);
  }
  const sectionLookup = new Map(sections.map((s) => [s.id, s]));
  const questions = {};
  for (const table of markdown.lexer(indexSource).filter((token) => token.type === "table")) {
    if (table.header.map((cell) => cell.text).join("|") !== "Q-ID|Review|Decisive distinction") throw new Error("Unexpected question-index columns");
    for (const row of table.rows) {
      const id = row[0].text.trim();
      if (!lookup.has(id) || questions[id]) throw new Error("Unknown or duplicate index question: " + id);
      const sectionIds = row[1].tokens.filter((t) => t.type === "link").map((t) => t.href.split("#")[1]);
      if (!sectionIds.length || new Set(sectionIds).size !== sectionIds.length || sectionIds.some((id) => !sectionLookup.has(id))) throw new Error("Invalid index sections for Q" + id);
      const rule = plain(markdown.parseInline(row[2].text));
      if (!rule) throw new Error("Empty distinction for Q" + id);
      questions[id] = { id, sectionIds, rule };
      sectionIds.forEach((sectionId) => sectionLookup.get(sectionId).questionIds.push(id));
    }
  }
  if (Object.keys(questions).length !== bank.length) throw new Error("Every bank question needs a guide index entry");
  const intro = guideSource.slice(0, headings[0].index).split("### Contents")[0].replace(/^#.*\n/gm, "");
  return {
    introductionHtml: render(intro),
    sections: sections.map(({ body, ...section }) => ({ ...section, html: render(body), text: plain(markdown.parse(body)) })),
    questions,
  };
}
