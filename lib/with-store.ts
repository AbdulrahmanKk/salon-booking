import { blobDiag, flushStore, initStore } from "./memory-store";

type RouteHandler = (...args: never[]) => Promise<Response> | Response;

/**
 * يغلّف مسار API بحيث يُحمّل التخزين قبل المعالجة ويُحفظ بعدها.
 * ضروري على Vercel لأن نظام الملفات مؤقت — البيانات في Vercel Blob.
 */
export function withStore<T extends RouteHandler>(handler: T): T {
  return (async (...args: Parameters<T>) => {
    blobDiag("REQUEST_START", { handler: handler.name || "anonymous" });
    await initStore();
    try {
      return await handler(...args);
    } finally {
      await flushStore();
      blobDiag("REQUEST_END", { handler: handler.name || "anonymous" });
    }
  }) as unknown as T;
}
