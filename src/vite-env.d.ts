declare module '*.css';
type Fetcher = { fetch(request: Request): Promise<Response> };
type ExecutionContext = { waitUntil(promise: Promise<unknown>): void; passThroughOnException(): void };
