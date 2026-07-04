/**
 * إرسال خارجي للإشعارات — جاهز لربط SMS / واتساب لاحقاً
 */

export interface ExternalDispatchPayload {
  phone: string;
  message: string;
  channel: "sms" | "whatsapp";
}

export interface ExternalDispatchResult {
  sent: boolean;
  reason: string;
}

export async function dispatchExternalNotification(
  payload: ExternalDispatchPayload,
): Promise<ExternalDispatchResult> {
  // TODO: ربط مزوّد SMS أو واتساب Business API
  console.info("[سوفت مومنت] external notification (disabled):", payload.channel, payload.phone);
  return { sent: false, reason: "external_dispatch_disabled" };
}
