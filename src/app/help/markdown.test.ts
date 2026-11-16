import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseMarkdown, slugify } from './markdown.ts'

test('title, headings with ids, lists, tables, callouts', () => {
  const doc = parseMarkdown(`# Title\n\nIntro **bold** and [link](/help/x).\n\n## Access and visibility\n\n- one\n- *two*\n\n1. a\n2. b\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n> **Note:** hi\n<!-- hidden -->`)
  assert.equal(doc.title, 'Title')
  assert.deepEqual(doc.headings, [{ id: 'access-and-visibility', text: 'Access and visibility', level: 2 }])
  assert.match(doc.html, /<strong>bold<\/strong>/)
  assert.match(doc.html, /<a href="\/help\/x">link<\/a>/)
  assert.match(doc.html, /<ul><li>one<\/li><li><em>two<\/em><\/li><\/ul>/)
  assert.match(doc.html, /<ol><li>a<\/li><li>b<\/li><\/ol>/)
  assert.match(doc.html, /<th>A<\/th>[\s\S]*<td>2<\/td>/)
  assert.match(doc.html, /<blockquote><strong>Note:<\/strong> hi<\/blockquote>/)
  assert.doesNotMatch(doc.html, /hidden/)
})

test('escapes HTML', () => {
  assert.match(parseMarkdown('a <b> & c').html, /a &lt;b&gt; &amp; c/)
})

test('slugify', () => assert.equal(slugify("What's *new* in 2026?"), 'whats-new-in-2026'))
