import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Bot, History } from 'lucide-react';
import { sendMessage, getHistory, getSessionMessages, type ChatMessage, type ChatSession } from '../services/chatService';

const ChatWidget: React.FC = () => {

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ChatSession[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const storedSessionId = localStorage.getItem('chatSessionId');
    if (storedSessionId) {
      setSessionId(storedSessionId);
      loadSessionMessages(storedSessionId);
    }
    
    const token = localStorage.getItem('token');
    setIsLoggedIn(!!token);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadSessionMessages = async (sid: string) => {
    try {
      const msgs = await getSessionMessages(sid);
      setMessages(msgs);
    } catch (error) {
      console.error("Failed to load session messages", error);
      // If session invalid, clear it
      localStorage.removeItem('chatSessionId');
      setSessionId(undefined);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: ChatMessage = {
      id: 'temp-' + Date.now(),
      sessionId: sessionId || '',
      role: 'user',
      content: input,
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await sendMessage(userMsg.content, sessionId);
      
      if (!sessionId) {
        setSessionId(response.sessionId);
        localStorage.setItem('chatSessionId', response.sessionId);
      }

      // Replace temp message with real one and add model response
      setMessages(prev => [
        ...prev.filter(m => m.id !== userMsg.id),
        response.userMessage,
        response.modelMessage
      ]);
    } catch (error) {
      console.error("Failed to send message", error);
      // Add error message
      setMessages(prev => [...prev, {
        id: 'error-' + Date.now(),
        sessionId: sessionId || '',
        role: 'model',
        content: "Sorry, I'm having trouble connecting right now. Please try again later.",
        createdAt: new Date().toISOString(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleHistoryClick = async () => {
    if (!showHistory) {
      try {
        const sessions = await getHistory();
        setHistory(sessions);
      } catch (error) {
        console.error("Failed to load history", error);
      }
    }
    setShowHistory(!showHistory);
  };

  const loadHistorySession = (sid: string) => {
    setSessionId(sid);
    localStorage.setItem('chatSessionId', sid);
    loadSessionMessages(sid);
    setShowHistory(false);
  };

  const startNewChat = () => {
    setSessionId(undefined);
    localStorage.removeItem('chatSessionId');
    setMessages([]);
    setShowHistory(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-all duration-300 transform hover:scale-110 flex items-center gap-2"
        >
          <MessageCircle size={28} />
          <span className="font-semibold hidden md:inline">Dr. Tooth</span>
        </button>
      )}

      {isOpen && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-80 md:w-96 flex flex-col h-[500px] border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300">
          {/* Header */}
          <div className="bg-blue-600 p-4 flex justify-between items-center text-white">
            <div className="flex items-center gap-2">
              <div className="bg-white/20 p-2 rounded-full">
                <Bot size={20} />
              </div>
              <div>
                <h3 className="font-bold">Dr. Tooth</h3>
                <p className="text-xs text-blue-100">AI Dental Assistant</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isLoggedIn && (
                <button 
                  onClick={handleHistoryClick}
                  className="p-1 hover:bg-white/20 rounded-full transition-colors"
                  title="Chat History"
                >
                  <History size={20} />
                </button>
              )}
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/20 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900">
            {showHistory ? (
              <div className="space-y-2">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-semibold text-gray-700 dark:text-gray-200">Chat History</h4>
                  <button 
                    onClick={startNewChat}
                    className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                  >
                    New Chat
                  </button>
                </div>
                {history.length === 0 ? (
                  <p className="text-gray-500 text-center text-sm">No history found.</p>
                ) : (
                  history.map(session => (
                    <div 
                      key={session.id}
                      onClick={() => loadHistorySession(session.id)}
                      className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md cursor-pointer border border-gray-100 dark:border-gray-700 transition-all"
                    >
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                        {session.messages && session.messages.length > 0 
                          ? session.messages[0].content 
                          : 'Empty conversation'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(session.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <>
                {messages.length === 0 && (
                  <div className="text-center text-gray-500 mt-10 px-4">
                    <Bot size={48} className="mx-auto mb-4 text-blue-300" />
                    <p className="font-semibold text-lg text-gray-700 dark:text-gray-200">Welcome to Dr. Tooth!</p>
                    <p className="text-sm mt-2">
                      I'm here to answer your oral health questions.
                    </p>
                    <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                      <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">Thakur Dental Clinic</p>
                      <p className="text-xs text-gray-400">Dr Ajay Singh Thakur</p>
                    </div>
                  </div>
                )}
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-2xl ${
                          msg.role === 'user'
                            ? 'bg-blue-600 text-white rounded-br-none'
                            : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-sm border border-gray-100 dark:border-gray-600 rounded-bl-none'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white dark:bg-gray-700 p-3 rounded-2xl rounded-bl-none shadow-sm border border-gray-100 dark:border-gray-600">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </>
            )}
          </div>

          {/* Input */}
          {!showHistory && (
            <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Type your question..."
                  className="flex-1 border border-gray-300 dark:border-gray-600 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send size={20} />
                </button>
              </div>
              <div className="text-center mt-2">
                <p className="text-[10px] text-gray-400">
                  Thakur Dental Clinic • Dr Ajay Singh Thakur
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatWidget;
