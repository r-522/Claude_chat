import { MODELS, type Effort, type ModelKey } from '../src/models';

type Env = { ANTHROPIC_API_KEY?: string; ASSETS: Fetcher };
type ChatMessage = { role: 'user' | 'assistant'; content: string };
const effortValues = new Set(['low', 'medium', 'high']);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

function errorMessage(status: number) {
  if (status === 401 || status === 403) return 'Anthropic APIキーの認証に失敗しました。Secretを確認してください。';
  if (status === 429) return '利用量が上限に達しました。少し時間を置いてから再度お試しください。';
  if (status >= 500) return 'Claude API側で一時的な問題が発生しています。';
  if (status === 400) return 'モデルまたはリクエスト内容を確認してください。';
  return 'Claude APIへの接続に失敗しました。';
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/api/chat') return env.ASSETS.fetch(request);
    if (request.method !== 'POST') return json({ error: '許可されていないメソッドです。' }, 405);
    if (!env.ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY がCloudflare Secretに設定されていません。' }, 500);

    let body: { messages?: ChatMessage[]; model?: ModelKey; effort?: Effort };
    try { body = await request.json(); } catch { return json({ error: 'リクエストの形式が正しくありません。' }, 400); }

    const selected = body.model && MODELS[body.model];
    if (!selected) return json({ error: '指定されたモデルは利用できません。' }, 400);
    if (!body.effort || !effortValues.has(body.effort)) return json({ error: '指定されたEffortは利用できません。' }, 400);
    const messages = (body.messages ?? []).filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim());
    if (!messages.length || messages[messages.length - 1].role !== 'user') return json({ error: '送信するメッセージがありません。' }, 400);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    const payload: Record<string, unknown> = { model: selected.id, max_tokens: 4096, stream: true, messages };
    if (selected.supportsEffort) payload.effort = body.effort;
    else if (body.effort !== 'low') payload.thinking = { type: 'enabled', budget_tokens: body.effort === 'medium' ? 2048 : 4096 };

    try {
      const upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: controller.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(payload),
      });
      clearTimeout(timeout);
      if (!upstream.ok || !upstream.body) {
        const detail = await upstream.text().catch(() => '');
        console.error('Anthropic API error', upstream.status, detail);
        return json({ error: errorMessage(upstream.status) }, upstream.status);
      }
      const headers = new Headers(upstream.headers);
      headers.set('content-type', 'text/event-stream; charset=utf-8');
      headers.set('cache-control', 'no-cache, no-transform');
      return new Response(upstream.body, { status: 200, headers });
    } catch (err) {
      clearTimeout(timeout);
      console.error('Chat route failed', err);
      return json({ error: err instanceof DOMException && err.name === 'AbortError' ? 'Claude APIの応答がタイムアウトしました。' : 'ネットワークエラーが発生しました。' }, err instanceof DOMException && err.name === 'AbortError' ? 504 : 502);
    }
  },
};
