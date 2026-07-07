import { blobDiag, flushStore, formatBlobError, initStore } from "./memory-store";

type RouteHandler = (...args: never[]) => Promise<Response> | Response;

/**
 * يغلّف مسار API بحيث يُحمّل التخزين قبل المعالجة ويُحفظ بعدها.
 * ضروري على Vercel لأن نظام الملفات مؤقت — البيانات في Vercel Blob.
 */
export function withStore<T extends RouteHandler>(handler: T): T {
  return (async (...args: Parameters<T>) => {
    blobDiag("REQUEST_START", { handler: handler.name || "anonymous" });
    try {
      await initStore();
    } catch (e) {
      console.error("[withStore] initStore failed:", formatBlobError(e));
      return Response.json({ error: "تعذّر تحميل البيانات" }, { status: 500 });
    }

    try {
      return await handler(...args);
    } finally {
      try {
        await flushStore();
      } catch (e) {
        console.error("[withStore] flushStore failed:", formatBlobError(e));
      }
      blobDiag("REQUEST_END", { handler: handler.name || "anonymous" });
    }
  }) as unknown as T;
}
