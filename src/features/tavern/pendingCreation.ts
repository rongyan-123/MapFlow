import type { CreateLearningConversationInput } from './types';

export function creationStorageKey(account: string, area?: string, management?: boolean): string {
  return `mapflow.tavern.creation.v1.${account}.${area ? `learning.${area}` : management ? 'management' : 'tavern'}`;
}

export function readPendingCreation(key: string): CreateLearningConversationInput | null {
  try {
    const encoded = localStorage.getItem(key);
    if (!encoded) return null;
    const request = JSON.parse(encoded) as CreateLearningConversationInput;
    if (!request || typeof request !== 'object' || Array.isArray(request)
      || typeof request.clientRequestId !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(request.clientRequestId)
      || typeof request.characterId !== 'string' || typeof request.userName !== 'string'
      || Object.keys(request).some(field => !['clientRequestId', 'characterId', 'userName', 'persona', 'vocabulary', 'greetingIndex', 'toolsEnabled'].includes(field))) return null;
    return request;
  } catch { return null; }
}

export function persistPendingCreation(key: string, request: CreateLearningConversationInput | null): void {
  if (request) localStorage.setItem(key, JSON.stringify(request));
  else localStorage.removeItem(key);
}
