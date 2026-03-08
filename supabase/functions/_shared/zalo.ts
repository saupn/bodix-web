/**
 * TODO: Tích hợp Zalo ZNS API.
 *
 * Docs   : https://developers.zalo.me/docs/zalo-notification-service
 * Cần    : ZNS App ID, Access Token (refresh mỗi 3600s), Template ID đã được duyệt
 *
 * Endpoint gửi ZNS:
 *   POST https://business.openapi.zalo.me/message/template
 *   Headers: { access_token: <ACCESS_TOKEN> }
 *   Body: {
 *     phone: "84912345678",   // định dạng quốc tế, không có dấu +
 *     template_id: "<ID>",
 *     template_data: { key: "value" },
 *     tracking_id: "<unique_id>"   // optional, để dedup
 *   }
 *
 * Lưu ý: phone phải đã từng nhắn tin cho OA trước (user opt-in).
 */
export async function sendZaloZNS(
  phone: string,
  templateId: string,
  params: Record<string, string>
): Promise<boolean> {
  console.log(`[zalo mock] phone=${phone} | template=${templateId}`, params)
  return true
}
