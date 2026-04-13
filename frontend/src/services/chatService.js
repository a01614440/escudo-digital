import { postJson } from '../lib/api.js';

export function sendChatConversation(messages, options = {}) {
  return postJson(
    '/api/chat',
    {
      messages: messages.map((message) => ({
        role: message.role === 'bot' ? 'assistant' : 'user',
        content: message.content,
      })),
    },
    options
  );
}
