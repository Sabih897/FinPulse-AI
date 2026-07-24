// client/src/components/AIChatDrawer.jsx
import React, { useState } from 'react';
import { MessageSquare, Send, X, Bot, User } from 'lucide-react';
import axios from '../api/axiosInstance';

export default function AIChatDrawer({ isOpen, onClose }) {
  const [messages, setMessages] = useState([
    { sender: 'ai', text: 'Hello! I am your FinPulse AI assistant. Ask me anything about your 90-day spending trends or budget optimization.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userQuery = input;
    setMessages((prev) => [
      ...prev, 
      { sender: 'user', text: userQuery },
      { sender: 'ai', text: 'Thinking...' }
    ]);
    setInput('');
    setLoading(true);

    try {
      const response = await axios.post('/ai/chat', { message: userQuery });
      const aiReply = response.data.text || 'No response generated.';
      
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1].text = aiReply;
        return updated;
      });
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1].text = 'Sorry, I encountered an error connecting to the AI service.';
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl z-50 flex flex-col border-l animate-in slide-in-from-right duration-300">
      
      {/* Header */}
      <div className="p-4 bg-indigo-600 text-white flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Bot className="h-6 w-6" />
          <span className="font-bold">FinPulse AI Advisor</span>
        </div>
        <button onClick={onClose} className="hover:opacity-80 transition"><X className="h-5 w-5" /></button>
      </div>

      {/* Message List */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50/50">
        {messages.map((m, idx) => (
          <div key={idx} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${m.sender === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-gray-800 border border-gray-100 shadow-sm rounded-tl-none'}`}>
              {m.text}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 border-t bg-white flex gap-2 items-center">
        <input 
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Ask about your expenses..."
          className="flex-1 border border-gray-200 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50/50"
        />
        <button 
          onClick={sendMessage} 
          disabled={loading || !input.trim()} 
          className="bg-indigo-600 text-white p-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

    </div>
  );
}