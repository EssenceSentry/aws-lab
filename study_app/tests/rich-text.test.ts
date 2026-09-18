import assert from "node:assert/strict";
import test from "node:test";
import { tokenizeRichText } from "../src/rich-text.ts";

test("Markdown citations use their title and leave closing punctuation outside the URL", () => {
  assert.deepEqual(tokenizeRichText("See [AWS docs](https://docs.aws.amazon.com/path.html), then [more](http://example.com/)."), [
    { type: "text", text: "See " },
    { type: "link", text: "AWS docs", href: "https://docs.aws.amazon.com/path.html" },
    { type: "text", text: ", then " },
    { type: "link", text: "more", href: "http://example.com/" },
    { type: "text", text: "." },
  ]);
});

test("balanced URL parentheses survive Markdown and prose delimiters", () => {
  assert.deepEqual(tokenizeRichText("[Guide](https://example.com/a_(b)?q=(c)#part). (https://example.com/a_(b))."), [
    { type: "link", text: "Guide", href: "https://example.com/a_(b)?q=(c)#part" },
    { type: "text", text: ". (" },
    { type: "link", text: "https://example.com/a_(b)", href: "https://example.com/a_(b)" },
    { type: "text", text: ")." },
  ]);
});

test("bare URLs retain queries and fragments while prose punctuation stays plain", () => {
  assert.deepEqual(tokenizeRichText("https://example.com/?a=1&b=2#key; [http://[::1]/a]!"), [
    { type: "link", text: "https://example.com/?a=1&b=2#key", href: "https://example.com/?a=1&b=2#key" },
    { type: "text", text: "; [" },
    { type: "link", text: "http://[::1]/a", href: "http://[::1]/a" },
    { type: "text", text: "]!" },
  ]);
});

test("code spans remain opaque to link recognition and preserve literal content", () => {
  assert.deepEqual(tokenizeRichText("Use `https://example.com/?a=1` and ``a `literal` [link](https://example.com/)``."), [
    { type: "text", text: "Use " },
    { type: "code", text: "https://example.com/?a=1" },
    { type: "text", text: " and " },
    { type: "code", text: "a `literal` [link](https://example.com/)" },
    { type: "text", text: "." },
  ]);
});

test("unsupported schemes, images, HTML, and malformed inline markup remain literal", () => {
  for (const value of [
    '[run](javascript:alert("https://example.com/"))',
    "[data](data:text/html,<script>alert(1)</script>)",
    "[mail](mailto:person@example.com)",
    "![diagram](https://example.com/image.png)",
    '<a href="https://example.com/" onclick="alert(1)">Docs</a><img src=x onerror=alert(1)>',
    '<a href="https://example.com/">https://example.com/</a>',
    '<script>alert("x")</script><!-- https://example.com/ -->',
    "[unfinished](https://example.com/",
    "`https://example.com/",
    "```https://example.com/```",
    '**bold** <b>text</b> [reference][1]',
    '[title](https://example.com/ "unsupported title")',
    "[bad](https://)",
  ]) assert.deepEqual(tokenizeRichText(value), [{ type: "text", text: value }], value);
});

test("literal labels and code cannot introduce HTML nodes", () => {
  assert.deepEqual(tokenizeRichText("[<img src=x onerror=alert(1)>](https://example.com/) `<script>alert(1)</script>`"), [
    { type: "link", text: "<img src=x onerror=alert(1)>", href: "https://example.com/" },
    { type: "text", text: " " },
    { type: "code", text: "<script>alert(1)</script>" },
  ]);
  assert.deepEqual(tokenizeRichText(""), []);
});
