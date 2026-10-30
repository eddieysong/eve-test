import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { searchWeb } from '../agent/lib/web-search.ts';
import webFetch from 'eve/tools/web_fetch';

const originalKey = process.env.OPENROUTER_API_KEY;
process.env.OPENROUTER_API_KEY = 'test-only-key';
after(() => { if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = originalKey; });
const result = annotations => ({ choices: [{ message: { content: 'A sourced answer.', annotations } }] });
const source = (url = 'https://example.com/reference') => ({ type: 'url_citation', url_citation: { url, title: 'Reference' } });

test('search uses only OpenRouter, one bounded search, and the supplied query', async () => {
  const answer = await searchWeb('public example', { fetch: async (url, request) => {
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(request.headers.authorization, 'Bearer test-only-key');
    const body = JSON.parse(request.body);
    assert.equal(body.messages[1].content, 'public example');
    assert.equal(body.tools[0].type, 'openrouter:web_search');
    assert.equal(body.tools[0].parameters.max_uses, 1);
    assert.equal(body.tools[0].parameters.max_results, 3);
    assert.equal(body.max_tool_calls, 1);
    assert.equal(body.stream, false);
    return Response.json(result([source(), source()]));
  }});
  assert.equal(answer.sources.length, 1);
  assert.equal(answer.searchRequests, null);
  assert.equal(answer.contentIsUntrusted, true);
});
test('rejects a model answer without evidence that search ran', async () => {
  await assert.rejects(searchWeb('query', {fetch: async () => Response.json(result([]))}), /evidence of a web search/);
});
test('filters unsafe source links and reports service errors without response contents', async () => {
  const answer = await searchWeb('query', {fetch: async () => Response.json(result([source(), source('javascript:alert(1)'), source('https://user:password@example.com')]))});
  assert.equal(answer.sources.length, 1);
  await assert.rejects(searchWeb('query', {fetch: async () => new Response('sensitive error details', {status:401})}), error => error.message.includes('401') && !error.message.includes('sensitive'));
});
test('web page reader rejects local network addresses and non-HTTPS URLs', async () => {
  const ctx = {abortSignal: new AbortController().signal};
  await assert.rejects(webFetch.execute({url:'http://127.0.0.1:2002'}, ctx));
  await assert.rejects(webFetch.execute({url:'https://127.0.0.1'}, ctx));
});
