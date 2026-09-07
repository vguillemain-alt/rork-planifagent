/**
 * Client helpers for the shared backend (task conversations + photos).
 * The backend is a Cloudflare Worker reachable at EXPO_PUBLIC_RORK_FUNCTIONS_URL.
 */

export const API_BASE = process.env.EXPO_PUBLIC_RORK_FUNCTIONS_URL ?? '';

export type MessageRole = 'admin' | 'viewer';

export interface TaskMessage {
  id: string;
  taskKey: string;
  role: MessageRole;
  text: string;
  photoId?: string;
  createdAt: string;
}

export function photoUrl(photoId: string): string {
  return `${API_BASE}/photos/${photoId}`;
}

export async function fetchTaskMessagesAsync(taskKey: string): Promise<TaskMessage[]> {
  const response = await fetch(`${API_BASE}/chat/${encodeURIComponent(taskKey)}`);
  if (!response.ok) {
    throw new Error(`fetch messages failed: ${response.status}`);
  }
  const payload = (await response.json()) as { messages: TaskMessage[] };
  return payload.messages;
}

export async function sendTaskMessageAsync(
  taskKey: string,
  role: MessageRole,
  text: string,
  photoId?: string,
  taskTitle?: string
): Promise<TaskMessage> {
  const response = await fetch(`${API_BASE}/chat/${encodeURIComponent(taskKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, text, photoId, taskTitle }),
  });
  if (!response.ok) {
    throw new Error(`send message failed: ${response.status}`);
  }
  const payload = (await response.json()) as { message: TaskMessage };
  return payload.message;
}

/**
 * Uploads a base64-encoded image and returns its photo id.
 */
export async function uploadPhotoAsync(base64: string, mime: 'image/jpeg' | 'image/png' = 'image/jpeg'): Promise<string> {
  const response = await fetch(`${API_BASE}/photos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: base64, mime }),
  });
  if (!response.ok) {
    throw new Error(`upload photo failed: ${response.status}`);
  }
  const payload = (await response.json()) as { photoId: string };
  return payload.photoId;
}
