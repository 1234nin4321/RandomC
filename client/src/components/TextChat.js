import React, { useState, useEffect, useRef } from 'react';
import './TextChat.css';

const TextChat = ({ socket, isMatched, partnerId, username, partnerUsername }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!socket || !isMatched) return;

    // Listen for incoming text messages
    const handleTextMessage = (data) => {
      setMessages(prev => [...prev, {
        id: Date.now() + Math.random(),
        text: data.message,
        from: 'partner',
        username: data.username || 'Anonymous',
        timestamp: data.timestamp
      }]);
    };

    // Listen for typing indicators
    const handleTyping = (data) => {
      setPartnerTyping(data.isTyping);
    };

    socket.on('textMessage', handleTextMessage);
    socket.on('typing', handleTyping);

    return () => {
      socket.off('textMessage', handleTextMessage);
      socket.off('typing', handleTyping);
    };
  }, [socket, isMatched]);

  // Clear messages when match ends
  useEffect(() => {
    if (!isMatched) {
      setMessages([]);
      setPartnerTyping(false);
    }
  }, [isMatched]);

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    
    // Send typing indicator
    if (socket) {
      socket.emit('typing', { isTyping: true });
      
      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set timeout to stop typing indicator
      typingTimeoutRef.current = setTimeout(() => {
        if (socket) {
          socket.emit('typing', { isTyping: false });
        }
      }, 1000);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket) return;

    const messageData = {
      id: Date.now() + Math.random(),
      text: newMessage.trim(),
      from: 'me',
      username: username || 'Anonymous',
      timestamp: new Date().toISOString()
    };

    // Add message to local state immediately
    setMessages(prev => [...prev, messageData]);
    
    // Send message to server
    socket.emit('textMessage', { message: newMessage.trim() });
    setNewMessage('');
    
    // Stop typing indicator
    if (socket) {
      socket.emit('typing', { isTyping: false });
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (!isMatched) {
    return null;
  }

  return (
    <div className="text-chat">
      <div className="chat-header">
        <h3>💬 Text Chat</h3>
        {partnerTyping && <span className="typing-indicator">Partner is typing...</span>}
      </div>
      
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="no-messages">
            <p>Start chatting with your partner!</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div 
              key={`${message.id}-${index}`}
              className={`message ${message.from === 'me' ? 'message-mine' : 'message-partner'}`}
            >
              <div className="message-content">
                <div className="message-username">
                  {message.username || (message.from === 'me' ? (username || 'Anonymous') : (partnerUsername || 'Anonymous'))}
                </div>
                <p>{message.text}</p>
                <span className="message-time">{formatTime(message.timestamp)}</span>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={sendMessage} className="message-input-form">
        <input
          type="text"
          value={newMessage}
          onChange={handleTyping}
          placeholder="Type your message..."
          className="message-input"
          disabled={!isMatched}
        />
        <button 
          type="submit" 
          className="send-button"
          disabled={!newMessage.trim() || !isMatched}
        >
          ➤
        </button>
      </form>
    </div>
  );
};

export default TextChat; 