'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, Users, X } from 'lucide-react';
import { io } from 'socket.io-client';

export default function ChatPage() {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Initialize socket
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('online_count', (count) => {
      setOnlineCount(count);
    });

    newSocket.on('match_found', () => {
      setIsSearching(false);
      setIsConnected(true);
      setMessages([]);
    });

    newSocket.on('receive_message', (msg) => {
      setMessages((prev) => [...prev, { text: msg, sender: 'stranger' }]);
    });

    newSocket.on('partner_typing', (isTyping) => {
      setPartnerTyping(isTyping);
    });

    newSocket.on('partner_disconnected', () => {
      setMessages((prev) => [...prev, { text: 'Stranger has disconnected.', sender: 'system' }]);
      setIsConnected(false);
    });

    return () => newSocket.close();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, partnerTyping]);

  const startSearch = () => {
    if (!socket) return;
    setIsSearching(true);
    setIsConnected(false);
    setMessages([]);
    socket.emit('start_search');
  };

  const handleDisconnect = () => {
    if (!socket) return;
    setIsSearching(false);
    setIsConnected(false);
    socket.emit('leave_chat');
  };

  const handleSend = (e) => {
    e?.preventDefault();
    if (!input.trim() || !isConnected || !socket) return;
    
    socket.emit('send_message', input);
    setMessages(prev => [...prev, { text: input, sender: 'you' }]);
    setInput('');
    socket.emit('typing', false);
  };

  const handleInput = (e) => {
    setInput(e.target.value);
    if (socket && isConnected) {
      socket.emit('typing', e.target.value.length > 0);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white font-sans overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
            <Users size={18} className="text-white" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">ABchat</h1>
        </div>
        <div className="flex items-center gap-2 bg-gray-800 px-3 py-1 rounded-full text-sm text-gray-300">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          {onlineCount.toLocaleString()} online
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative">
        {!isSearching && !isConnected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 p-6 text-center">
            <h2 className="text-4xl font-bold mb-4">Chat with random strangers</h2>
            <p className="text-gray-400 mb-8 max-w-md">Instantly connect with people worldwide. No login required. 100% anonymous.</p>
            <button 
              onClick={startSearch}
              className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-full font-bold text-lg transition-transform hover:scale-105 shadow-lg shadow-blue-500/20"
            >
              Start Chatting
            </button>
          </div>
        )}

        {isSearching && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
            <div className="w-20 h-20 border-4 border-gray-800 border-t-blue-500 rounded-full animate-spin mb-6"></div>
            <p className="text-xl text-gray-300 animate-pulse">Searching for a stranger...</p>
            <button onClick={handleDisconnect} className="mt-8 text-gray-500 hover:text-white">Cancel</button>
          </div>
        )}

        {isConnected && (
          <div className="flex-1 flex flex-col w-full max-w-4xl mx-auto h-full relative">
            <div className="p-4 bg-gray-800/50 text-center text-sm text-gray-400">
              You're now chatting with a random stranger. Say hi!
            </div>
            
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {messages.map((msg, idx) => (
                <div key={idx} className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  msg.sender === 'system'
                    ? 'bg-transparent text-gray-500 self-center text-sm'
                    : msg.sender === 'you' 
                    ? 'bg-blue-600 text-white self-end rounded-br-sm' 
                    : 'bg-gray-800 text-gray-100 self-start rounded-bl-sm'
                }`}>
                  {msg.text}
                </div>
              ))}
              {partnerTyping && (
                <div className="bg-gray-800 text-gray-400 self-start rounded-2xl rounded-bl-sm px-4 py-2 flex gap-1 items-center">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="p-4 bg-gray-900 border-t border-gray-800">
              <form onSubmit={handleSend} className="flex gap-2">
                <button 
                  type="button"
                  onClick={handleDisconnect}
                  className="p-3 text-gray-400 hover:text-white bg-gray-800 hover:bg-red-600 rounded-full transition-colors flex-shrink-0"
                  title="Disconnect"
                >
                  <X size={20} />
                </button>
                <input
                  type="text"
                  value={input}
                  onChange={handleInput}
                  placeholder="Type a message..."
                  className="flex-1 bg-gray-800 text-white rounded-full px-6 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <button 
                  type="submit"
                  disabled={!input.trim()}
                  className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors flex-shrink-0"
                >
                  <Send size={20} />
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
