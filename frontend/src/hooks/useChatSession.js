import { useState } from 'react';
import { sendChatConversation } from '../services/chatService.js';

export function useChatSession() {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);

  const resetChat = () => {
    setChatMessages([]);
    setChatInput('');
    setChatBusy(false);
    setChatOpen(false);
  };

  const closeChat = () => {
    setChatOpen(false);
  };

  const handleChatSubmit = async () => {
    const text = chatInput.trim();
    if (!text || chatBusy) return;

    const nextMessages = [...chatMessages, { role: 'user', content: text }];
    setChatMessages(nextMessages);
    setChatInput('');
    setChatBusy(true);

    try {
      const response = await sendChatConversation(nextMessages);
      setChatMessages((current) => [
        ...current,
        { role: 'bot', content: response?.reply || 'No tengo respuesta en este momento.' },
      ]);
    } catch (error) {
      setChatMessages((current) => [
        ...current,
        {
          role: 'bot',
          content: `No pude conectar con la IA. ${error.message || 'Intenta de nuevo.'}`,
        },
      ]);
    } finally {
      setChatBusy(false);
    }
  };

  return {
    chatOpen,
    setChatOpen,
    chatMessages,
    chatInput,
    setChatInput,
    chatBusy,
    closeChat,
    resetChat,
    handleChatSubmit,
  };
}
