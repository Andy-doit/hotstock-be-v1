import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { escapeHtmlText } from '../src/common/utils/html-escape';

test('escapeHtmlText escapes unsafe HTML text characters', () => {
  const escaped = escapeHtmlText(`<script>alert("x" & 'y')</script>`);

  assert.equal(
    escaped,
    '&lt;script&gt;alert(&quot;x&quot; &amp; &#39;y&#39;)&lt;/script&gt;',
  );
});

test('escapeHtmlText preserves multiline content for pre-wrap rendering', () => {
  const escaped = escapeHtmlText('Dòng 1\nDòng <2> & tiếp theo');

  assert.equal(escaped, 'Dòng 1\nDòng &lt;2&gt; &amp; tiếp theo');
});
