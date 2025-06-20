# 🎥 Random Video Chat

A modern web application that allows users to connect with random strangers through video chat, similar to Omegle. Built with React, Node.js, Socket.IO, and WebRTC.

## ✨ Features

- **Random Video Matching**: Connect with random users from around the world
- **Real-time Video Chat**: High-quality video and audio communication
- **Modern UI**: Beautiful, responsive design with smooth animations
- **WebRTC Technology**: Peer-to-peer video streaming for optimal performance
- **Cross-platform**: Works on desktop and mobile devices
- **Privacy-focused**: No user accounts or data storage required

## 🚀 Quick Start

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn
- A modern web browser with camera/microphone access

### Installation

1. **Clone or download the project**
   ```bash
   git clone <repository-url>
   cd RandomChat
   ```

2. **Install dependencies**
   ```bash
   # Install server dependencies
   npm install
   
   # Install client dependencies
   cd client
   npm install
   cd ..
   ```

3. **Start the development servers**
   ```bash
   # Start both server and client (recommended)
   npm run dev
   
   # Or start them separately:
   # Terminal 1 - Start the server
   npm run server
   
   # Terminal 2 - Start the client
   npm run client
   ```

4. **Open your browser**
   - Navigate to `http://localhost:3000`
   - Allow camera and microphone permissions when prompted
   - Click "Start Video Chat" to begin

## 🛠️ Technology Stack

### Frontend
- **React 18**: Modern UI framework
- **Socket.IO Client**: Real-time communication
- **WebRTC**: Peer-to-peer video streaming
- **CSS3**: Modern styling with gradients and animations

### Backend
- **Node.js**: Server runtime
- **Express**: Web framework
- **Socket.IO**: Real-time bidirectional communication
- **CORS**: Cross-origin resource sharing

## 📱 How It Works

1. **Connection**: Users connect to the server via WebSocket
2. **Matching**: The server pairs users who are looking for matches
3. **WebRTC Setup**: Once matched, users establish peer-to-peer connections
4. **Video Chat**: Direct video/audio streaming between matched users
5. **Next Match**: Users can skip to the next random person

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
PORT=5000
NODE_ENV=development
```

### Customization

- **STUN Servers**: Modify the ICE servers in `client/src/App.js` for better connectivity
- **UI Styling**: Customize colors and design in `client/src/index.css` and `client/src/App.css`
- **Server Settings**: Adjust timeouts and connection limits in `server/index.js`

## 🌐 Deployment

### Production Build

```bash
# Build the React app
npm run build

# The built files will be in client/build/
```

### Deployment Options

- **Heroku**: Deploy both server and client
- **Vercel**: Deploy the React frontend
- **Railway**: Deploy the Node.js backend
- **AWS/GCP**: Deploy on cloud platforms

## 🔒 Privacy & Security

- **No Data Storage**: The application doesn't store any user data
- **Peer-to-Peer**: Video streams are direct between users
- **HTTPS Required**: Production deployment requires HTTPS for camera access
- **User Guidelines**: Users are reminded to be respectful

## 🐛 Troubleshooting

### Common Issues

1. **Camera/Microphone Access Denied**
   - Check browser permissions
   - Ensure HTTPS is used in production
   - Try refreshing the page

2. **No Video/Audio**
   - Check device permissions
   - Ensure camera/microphone is not in use by other applications
   - Try a different browser

3. **Connection Issues**
   - Check firewall settings
   - Ensure STUN servers are accessible
   - Try using a VPN

4. **No Matches Found**
   - Wait a few moments for other users
   - Check server connection
   - Try refreshing the page

### Browser Compatibility

- **Chrome**: Full support (recommended)
- **Firefox**: Full support
- **Safari**: Full support
- **Edge**: Full support
- **Mobile browsers**: Limited support

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## ⚠️ Disclaimer

This application is for educational purposes. Users are responsible for their own behavior and should follow community guidelines. The developers are not responsible for user interactions.

## 📞 Support

If you encounter any issues or have questions:

1. Check the troubleshooting section
2. Search existing issues
3. Create a new issue with detailed information

---

**Enjoy connecting with people around the world! 🌍** 