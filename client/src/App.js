import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import TextChat from './components/TextChat';
import './App.css';

const SERVER_URL = 'http://localhost:5000';

function App() {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [isMatched, setIsMatched] = useState(false);
  const [partnerId, setPartnerId] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const [error, setError] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminToken, setAdminToken] = useState(localStorage.getItem('adminToken'));
  const [chatMode, setChatMode] = useState(''); // 'text', 'both', or empty
  const [chatEnded, setChatEnded] = useState(false); // Track if chat has ended
  const [disconnectionMessage, setDisconnectionMessage] = useState(''); // Track disconnection message
  const [username, setUsername] = useState(''); // User's chosen username
  const [partnerUsername, setPartnerUsername] = useState(''); // Partner's username

  const localVideoRef = useRef();
  const remoteVideoRef = useRef();

  // Check if we're on admin route
  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/admin') {
      setIsAdmin(true);
    }
  }, []);

  // Socket connection and video chat logic
  useEffect(() => {
    if (isAdmin) return; // Don't connect socket for admin panel

    const newSocket = io(SERVER_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      setError(null);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      setIsWaiting(false);
      setIsMatched(false);
    });

    newSocket.on('waitingForMatch', () => {
      setIsWaiting(true);
      setError(null);
    });

    newSocket.on('matchFound', (data) => {
      setIsWaiting(false);
      setIsMatched(true);
      setPartnerId(data.partnerId);
      setChatMode(data.mode || 'both');
      setPartnerUsername(data.partnerUsername || 'Anonymous');
      initializePeerConnection();
    });

    newSocket.on('partnerDisconnected', () => {
      setIsMatched(false);
      setPartnerId(null);
      setRemoteStream(null);
      if (peerConnection) {
        peerConnection.close();
        setPeerConnection(null);
      }
      setDisconnectionMessage('Partner has disconnected from the chat.');
    });

    newSocket.on('matchTimeout', () => {
      setIsWaiting(false);
      setDisconnectionMessage('No match found. Please try again.');
    });

    return () => {
      newSocket.close();
    };
  }, [isAdmin]);

  // WebRTC signaling
  useEffect(() => {
    if (!socket || isAdmin) return;

    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('iceCandidate', handleIceCandidate);

    return () => {
      socket.off('offer');
      socket.off('answer');
      socket.off('iceCandidate');
    };
  }, [socket, peerConnection, isAdmin]);

  // Admin authentication
  const handleAdminLogin = (token) => {
    setAdminToken(token);
    setIsAdmin(true);
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('adminToken');
    setAdminToken(null);
    setIsAdmin(false);
    window.history.pushState({}, '', '/');
  };

  const initializePeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('iceCandidate', {
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    setPeerConnection(pc);
    return pc;
  };

  const handleOffer = async (data) => {
    if (!peerConnection) return;
    
    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      if (socket) {
        socket.emit('answer', {
          answer: answer
        });
      }
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  };

  const handleAnswer = async (data) => {
    if (!peerConnection) return;
    
    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  };

  const handleIceCandidate = async (data) => {
    if (!peerConnection) return;
    
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  };

  const startChat = async () => {
    try {
      // Only request media if video mode is selected
      if (chatMode === 'both') {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      }
      
      if (socket) {
        socket.emit('findMatch', { mode: chatMode, username: username || 'Anonymous' });
      }
      
      setChatEnded(false); // Reset chat ended state
      setDisconnectionMessage(''); // Reset disconnection message
    } catch (error) {
      setError('Failed to access camera/microphone. Please check permissions.');
      console.error('Error accessing media devices:', error);
    }
  };

  const stopVideoChat = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }
    
    setIsWaiting(false);
    setIsMatched(false);
    setPartnerId(null);
    setRemoteStream(null);
    setError(null);
    setChatEnded(false); // Reset chat ended state
    setDisconnectionMessage(''); // Reset disconnection message
  };

  const endChat = () => {
    if (socket) {
      socket.emit('endChat');
    }
    stopVideoChat();
    // Show disconnection message instead of immediately ending chat
    setDisconnectionMessage('You have ended the chat.');
  };

  const nextMatch = () => {
    if (localStream && socket) {
      socket.emit('nextMatch');
    }
  };

  const newChat = () => {
    // End current chat and immediately search for new partner
    if (socket) {
      socket.emit('nextMatch');
    }
    stopVideoChat();
    // Set waiting state immediately
    setIsWaiting(true);
    // Don't reset chatMode - keep the current mode
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
      }
    }
  };

  const goToAdmin = () => {
    window.history.pushState({}, '', '/admin');
    setIsAdmin(true);
  };

  // If admin route, show admin components
  if (isAdmin) {
    if (!adminToken) {
      return <AdminLogin onLogin={handleAdminLogin} />;
    }
    return <AdminDashboard token={adminToken} onLogout={handleAdminLogout} />;
  }

  // Regular video chat UI
  return (
    <div className="App">
      <div className="container">
        <header className="header">
          <h1>🎥 Random Video Chat</h1>
          <p>Connect with strangers around the world</p>
          <button className="btn btn-secondary" onClick={goToAdmin} style={{ marginTop: '10px' }}>
            🛡️ Admin Panel
          </button>
        </header>

        <main className="main-content">
          {!isConnected && (
            <div className="card">
              <div className="loading">
                <div className="spinner"></div>
                Connecting to server...
              </div>
            </div>
          )}

          {isConnected && !localStream && !chatMode && (
            <div className="card">
              <h2>Welcome to Random Chat!</h2>
              <p>Choose your preferred chat mode and start connecting with random people.</p>
              
              <div className="username-section">
                <label htmlFor="username">Choose a username:</label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username (optional)"
                  maxLength={20}
                  className="username-input"
                />
                <small>Leave empty to use "Anonymous"</small>
              </div>
              
              <div className="mode-selection">
                <div 
                  className="mode-option"
                  onClick={() => setChatMode('text')}
                >
                  <div className="mode-icon">💬</div>
                  <h3>Text Only</h3>
                  <p>Chat via text messages only</p>
                  <ul>
                    <li>No camera/microphone needed</li>
                    <li>Faster connections</li>
                    <li>More privacy</li>
                  </ul>
                </div>
                
                <div 
                  className="mode-option"
                  onClick={() => setChatMode('both')}
                >
                  <div className="mode-icon">🎥💬</div>
                  <h3>Video + Text</h3>
                  <p>Best of both worlds</p>
                  <ul>
                    <li>Video and text chat</li>
                    <li>Most interactive</li>
                    <li>Camera required</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {isConnected && !localStream && chatMode && !isWaiting && !isMatched && (
            <div className="card">
              <h2>Selected Mode</h2>
              <div className="selected-mode">
                <div className="mode-option selected">
                  <div className="mode-icon">
                    {chatMode === 'text' ? '💬' : '🎥💬'}
                  </div>
                  <h3>
                    {chatMode === 'text' ? 'Text Only' : 'Video + Text'}
                  </h3>
                  <p>
                    {chatMode === 'text' 
                      ? 'Chat via text messages only' 
                      : 'Video and text chat - best of both worlds'
                    }
                  </p>
                </div>
              </div>
              
              <div className="username-section">
                <label htmlFor="username-final">Your username:</label>
                <input
                  type="text"
                  id="username-final"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username (optional)"
                  maxLength={20}
                  className="username-input"
                />
                <small>You'll appear as: <strong>{username || 'Anonymous'}</strong></small>
              </div>
              
              <div className="mode-actions">
                <button className="btn" onClick={startChat}>
                  {chatMode === 'text' && '💬 Start Text Chat'}
                  {chatMode === 'both' && '🎥💬 Start Video + Text Chat'}
                </button>
              </div>
            </div>
          )}

          {isWaiting && (
            <div className="card">
              <div className="waiting-state">
                <div className="waiting-icon">🔍</div>
                <h2>Looking for someone to chat with...</h2>
                <p>Please wait while we find you a compatible partner</p>
                <div className="loading-spinner">
                  <div className="spinner"></div>
                </div>
                <div className="waiting-info">
                  <p>Mode: <strong>{chatMode === 'text' ? 'Text Only' : 'Video + Text'}</strong></p>
                  <p>Username: <strong>{username || 'Anonymous'}</strong></p>
                  <p>This may take a few moments</p>
                </div>
                <button className="btn btn-danger" onClick={stopVideoChat}>
                  Cancel Search
                </button>
              </div>
            </div>
          )}

          {isMatched && (
            <div className="card">
              <h2>You're connected! 🎉</h2>
              <div className="connection-info">
                <p><strong>You:</strong> {username || 'Anonymous'}</p>
                <p><strong>Partner:</strong> {partnerUsername || 'Anonymous'}</p>
              </div>
              <div className="chat-layout">
                {chatMode === 'both' && (
                  <div className="video-section">
                    <div className="video-grid">
                      <div className="video-container">
                        <video
                          ref={localVideoRef}
                          autoPlay
                          muted
                          playsInline
                          className="video-stream"
                        />
                        <div className="video-label">{username || 'Anonymous'}</div>
                      </div>
                      <div className="video-container">
                        <video
                          ref={remoteVideoRef}
                          autoPlay
                          playsInline
                          className="video-stream"
                          srcObject={remoteStream}
                        />
                        <div className="video-label">{partnerUsername || 'Anonymous'}</div>
                      </div>
                    </div>
                    
                    <div className="controls">
                      <button className="btn btn-secondary" onClick={toggleMute}>
                        🔇 Mute
                      </button>
                      <button className="btn btn-secondary" onClick={toggleVideo}>
                        📹 Video
                      </button>
                      <button className="btn" onClick={nextMatch}>
                        ⏭️ Next
                      </button>
                    </div>
                  </div>
                )}
                
                {(chatMode === 'text' || chatMode === 'both') && (
                  <div className={`text-section ${chatMode === 'text' ? 'text-only' : ''}`}>
                    <TextChat 
                      socket={socket} 
                      isMatched={isMatched} 
                      partnerId={partnerId}
                      username={username}
                      partnerUsername={partnerUsername}
                    />
                  </div>
                )}
              </div>
              
              <div className="chat-actions">
                <button className="btn btn-danger" onClick={endChat}>
                  ❌ End Chat
                </button>
              </div>
            </div>
          )}

          {disconnectionMessage && (
            <div className="card">
              <h2>Chat Ended</h2>
              <p>{disconnectionMessage}</p>
              <div className="mode-actions">
                <button className="btn btn-success" onClick={() => {
                  setDisconnectionMessage('');
                  setChatMode('');
                }}>
                  🆕 Start New Chat
                </button>
              </div>
            </div>
          )}

          {chatEnded && (
            <div className="card">
              <h2>Chat Ended</h2>
              <p>Your chat session has ended. Would you like to start a new chat?</p>
              <div className="mode-actions">
                <button className="btn btn-success" onClick={() => setChatEnded(false)}>
                  🆕 Start New Chat
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="card error-card">
              <h3>⚠️ {error}</h3>
              <button className="btn" onClick={() => setError(null)}>
                Dismiss
              </button>
            </div>
          )}
        </main>

        <footer className="footer">
          <p>⚠️ Remember to be respectful and follow community guidelines</p>
        </footer>
      </div>
    </div>
  );
}

export default App; 