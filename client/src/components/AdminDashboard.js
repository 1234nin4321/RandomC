import React, { useState, useEffect } from 'react';
import './AdminDashboard.css';

const AdminDashboard = ({ token, onLogout }) => {
  const [activeChats, setActiveChats] = useState([]);
  const [bans, setBans] = useState([]);
  const [recentMessages, setRecentMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [banIdentifier, setBanIdentifier] = useState('');
  const [banReason, setBanReason] = useState('');

  const fetchWithAuth = async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (response.status === 401) {
      onLogout();
      return null;
    }
    
    return response;
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load active chats
      const chatsResponse = await fetchWithAuth('/admin/active-chats');
      if (chatsResponse) {
        const chatsData = await chatsResponse.json();
        setActiveChats(chatsData.chats || []);
      }
      
      // Load recent messages
      const messagesResponse = await fetchWithAuth('/admin/recent-messages');
      if (messagesResponse) {
        const messagesData = await messagesResponse.json();
        setRecentMessages(messagesData.messages || []);
      }
      
      // Load bans
      const bansResponse = await fetchWithAuth('/admin/bans');
      if (bansResponse) {
        const bansData = await bansResponse.json();
        setBans(bansData.bans || []);
      }
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [token]);

  const handleBan = async (e) => {
    e.preventDefault();
    if (!banIdentifier.trim()) return;

    try {
      const response = await fetchWithAuth('/admin/ban', {
        method: 'POST',
        body: JSON.stringify({
          identifier: banIdentifier,
          reason: banReason
        }),
      });

      if (response && response.ok) {
        setBanIdentifier('');
        setBanReason('');
        loadData();
      } else {
        setError('Failed to ban user');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  const handleUnban = async (identifier) => {
    try {
      const response = await fetchWithAuth('/admin/unban', {
        method: 'POST',
        body: JSON.stringify({ identifier }),
      });

      if (response && response.ok) {
        loadData();
      } else {
        setError('Failed to unban user');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="admin-dashboard">
        <div className="loading">Loading admin data...</div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <h1>🛡️ Admin Dashboard</h1>
        <button className="btn btn-danger" onClick={onLogout}>
          Logout
        </button>
      </header>

      {error && (
        <div className="error-card">
          <h3>⚠️ {error}</h3>
          <button className="btn" onClick={() => setError('')}>
            Dismiss
          </button>
        </div>
      )}

      <div className="dashboard-grid">
        {/* Active Chats Section */}
        <div className="dashboard-card">
          <h2>📹 Active Chats ({activeChats.length})</h2>
          <div className="chats-list">
            {activeChats.length === 0 ? (
              <p className="no-data">No active chats</p>
            ) : (
              activeChats.map((chat, index) => (
                <div key={index} className="chat-item">
                  <div className="chat-users">
                    <span className="user-info">
                      <span className="username">{chat.userUsername || 'Anonymous'}</span>
                      <span className="user-id">({chat.userId.slice(0, 8)}...)</span>
                    </span>
                    <span className="chat-arrow">↔</span>
                    <span className="user-info">
                      <span className="username">{chat.partnerUsername || 'Anonymous'}</span>
                      <span className="user-id">({chat.partnerId.slice(0, 8)}...)</span>
                    </span>
                  </div>
                  <div className="chat-info">
                    <span className="chat-mode">
                      {chat.userMode} ↔ {chat.partnerMode}
                    </span>
                  </div>
                  <button 
                    className="btn btn-danger btn-small"
                    onClick={() => handleBan(null, { target: { value: chat.userId } })}
                  >
                    Ban Both
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Messages Section */}
        <div className="dashboard-card">
          <h2>💬 Recent Messages ({recentMessages.length})</h2>
          <div className="messages-list">
            {recentMessages.length === 0 ? (
              <p className="no-data">No recent messages</p>
            ) : (
              recentMessages.slice(0, 10).map((msg, index) => (
                <div key={index} className="message-item">
                  <div className="message-info">
                    <span className="message-user">
                      {msg.username || 'Anonymous'} ({msg.from.slice(0, 8)}...)
                    </span>
                    <span className="message-text">{msg.message}</span>
                    <span className="message-time">{formatDate(msg.timestamp)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Ban Management Section */}
        <div className="dashboard-card">
          <h2>🚫 Ban Management</h2>
          
          {/* Add Ban Form */}
          <form onSubmit={handleBan} className="ban-form">
            <div className="form-group">
              <label htmlFor="banIdentifier">User ID or IP:</label>
              <input
                type="text"
                id="banIdentifier"
                value={banIdentifier}
                onChange={(e) => setBanIdentifier(e.target.value)}
                placeholder="Enter user ID or IP address"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="banReason">Reason (optional):</label>
              <input
                type="text"
                id="banReason"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Reason for ban"
              />
            </div>
            <button type="submit" className="btn btn-danger">
              Ban User
            </button>
          </form>

          {/* Bans List */}
          <div className="bans-list">
            <h3>Banned Users ({bans.length})</h3>
            {bans.length === 0 ? (
              <p className="no-data">No banned users</p>
            ) : (
              bans.map((ban) => (
                <div key={ban.id} className="ban-item">
                  <div className="ban-info">
                    <span className="ban-identifier">{ban.identifier}</span>
                    {ban.reason && <span className="ban-reason">({ban.reason})</span>}
                    <span className="ban-date">{formatDate(ban.created_at)}</span>
                  </div>
                  <button 
                    className="btn btn-secondary btn-small"
                    onClick={() => handleUnban(ban.identifier)}
                  >
                    Unban
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard; 