import { flushStore, initStore } from "./memory-store";

type RouteHandler = (...args: never[]) => Promise<Response> | Response;

/**
 * يغلّف مسار API بحيث يُحمّل التخزين قبل المعالجة ويُحفظ بعدها.
 * ضروري على Vercel لأن نظام الملفات مؤقت — البيانات في Vercel Blob.
 */
export function withStore<T extends RouteHandler>(handler: T): T {
  return (async (...args: Parameters<T>) => {
    await initStore();
    try {
      return await handler(...args);
    } finally {
      await flushStore();
    }
  }) as unknown as T;
}
