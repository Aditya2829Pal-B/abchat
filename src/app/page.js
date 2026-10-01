'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, Users, X, Video, VideoOff, Mic, MicOff } from 'lucide-react';
import { io } from 'socket.io-client';

export default function ChatPage() {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  
  // Media states
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const messagesEndRef = useRef(null);
  const peerRef = useRef(null);

  useEffect(() => {
    // Initialize socket
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('online_count', (count) => {
      setOnlineCount(count);
    });

    newSocket.on('match_found', async ({ initiator }) => {
      setIsSearching(false);
      setIsConnected(true);
      setMessages([]);
      
      // Initialize WebRTC Peer Connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      peerRef.current = pc;

      // Add local tracks to peer connection
      if (localStream) {
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
      }

      // Handle incoming remote tracks
      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          newSocket.emit('signal', { type: 'ice', candidate: event.candidate });
        }
      };

      if (initiator) {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          newSocket.emit('signal', { type: 'offer', offer });
        } catch (err) {
          console.error('Error creating offer:', err);
        }
      }
    });

    newSocket.on('signal', async (data) => {
      const pc = peerRef.current;
      if (!pc) return;

      try {
        if (data.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          newSocket.emit('signal', { type: 'answer', answer });
        } else if (data.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        } else if (data.type === 'ice' && data.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch (err) {
        console.error('Error handling signal:', err);
      }
    });

    newSocket.on('receive_message', (msg) => {
      setMessages((prev) => [...prev, { text: msg, sender: 'stranger' }]);
    });

    newSocket.on('partner_disconnected', () => {
      setMessages((prev) => [...prev, { text: 'Stranger has disconnected.', sender: 'system' }]);
      cleanupPeer();
      setIsConnected(false);
    });

    return () => {
      cleanupPeer();
      newSocket.close();
    };
  }, [localStream]);

  // Bind video streams to elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, isConnected]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
    } catch (err) {
      console.error('Error accessing media devices:', err);
      alert('Camera and microphone access is required to chat.');
    }
  };

  const cleanupPeer = () => {
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    setRemoteStream(null);
  };

  const startSearch = async () => {
    if (!localStream) {
      await startCamera();
    }
    if (!socket) return;
    cleanupPeer();
    setIsSearching(true);
    setIsConnected(false);
    setMessages([]);
    socket.emit('start_search');
  };

  const handleDisconnect = () => {
    if (!socket) return;
    cleanupPeer();
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
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white font-sans overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-transparent absolute top-0 w-full z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shadow-lg">
            <Users size={18} className="text-white" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent drop-shadow-md">ABchat</h1>
        </div>
        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-sm text-gray-200 shadow-lg border border-white/10">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          {onlineCount.toLocaleString()} online
        </div>
      </header>

      {/* Main Content Area (Full screen video layout) */}
      <main className="flex-1 relative w-full h-full bg-gray-950 flex items-center justify-center">
        
        {/* Remote Video Background */}
        {remoteStream ? (
          <video 
            ref={remoteVideoRef} 
            autoPlay 
            playsInline 
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-black w-full h-full flex items-center justify-center">
            {!isSearching && !isConnected && (
              <div className="text-center z-20 px-4">
                <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Meet New People</h2>
                <p className="text-gray-400 mb-8 max-w-md mx-auto text-lg">Instant live video chat with random strangers worldwide.</p>
                <button 
                  onClick={startSearch}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-full font-bold text-xl transition-all hover:scale-105 shadow-[0_0_40px_rgba(37,99,235,0.4)]"
                >
                  Tap to Start
                </button>
              </div>
            )}
            
            {isSearching && (
              <div className="text-center z-20">
                <div className="w-24 h-24 border-4 border-gray-800 border-t-blue-500 rounded-full animate-spin mb-6 mx-auto shadow-[0_0_30px_rgba(37,99,235,0.3)]"></div>
                <p className="text-2xl text-gray-200 font-medium tracking-wide animate-pulse">Finding a match...</p>
                <button onClick={handleDisconnect} className="mt-8 px-6 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-colors">Cancel</button>
              </div>
            )}
          </div>
        )}

        {/* Local Video PIP (Picture-in-Picture) */}
        {(localStream || isConnected) && (
          <div className="absolute top-20 right-4 md:right-8 w-28 md:w-48 aspect-[3/4] bg-gray-800 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/10 z-30 transition-all">
            <video 
              ref={localVideoRef} 
              autoPlay 
              playsInline 
              muted 
              className={`w-full h-full object-cover ${!videoEnabled ? 'opacity-0' : 'opacity-100'}`}
              style={{ transform: 'scaleX(-1)' }}
            />
            {!videoEnabled && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-gray-500">
                <VideoOff size={32} />
              </div>
            )}
          </div>
        )}

        {/* Floating Controls Overlay */}
        {isConnected && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-40">
            <button 
              onClick={toggleVideo}
              className={`p-4 rounded-full shadow-lg backdrop-blur-md transition-colors ${videoEnabled ? 'bg-black/40 hover:bg-black/60 text-white' : 'bg-red-500/80 text-white'}`}
            >
              {videoEnabled ? <Video size={24} /> : <VideoOff size={24} />}
            </button>
            <button 
              onClick={toggleAudio}
              className={`p-4 rounded-full shadow-lg backdrop-blur-md transition-colors ${audioEnabled ? 'bg-black/40 hover:bg-black/60 text-white' : 'bg-red-500/80 text-white'}`}
            >
              {audioEnabled ? <Mic size={24} /> : <MicOff size={24} />}
            </button>
            <button 
              onClick={handleDisconnect}
              className="p-4 rounded-full shadow-lg backdrop-blur-md bg-red-600 hover:bg-red-500 text-white transition-transform hover:scale-110"
              title="Next Match"
            >
              <X size={24} />
            </button>
          </div>
        )}

        {/* Text Chat Overlay (Monkey/TikTok Style) */}
        {isConnected && (
          <div className="absolute bottom-0 left-0 w-full md:w-[400px] h-[50vh] flex flex-col z-40 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-10">
            
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 mask-image-btt">
              {messages.map((msg, idx) => (
                <div key={idx} className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                  msg.sender === 'system'
                    ? 'bg-black/40 text-yellow-400 self-center backdrop-blur-sm border border-white/10 font-medium'
                    : msg.sender === 'you' 
                    ? 'bg-blue-600/90 text-white self-end rounded-br-sm backdrop-blur-sm' 
                    : 'bg-white/20 text-white self-start rounded-bl-sm backdrop-blur-sm'
                }`}>
                  {msg.text}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="p-4 pb-6 md:pb-4">
              <form onSubmit={handleSend} className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Say something..."
                  className="flex-1 bg-black/50 border border-white/20 text-white rounded-full px-5 py-3 focus:outline-none focus:border-blue-500 backdrop-blur-md placeholder:text-gray-400 shadow-lg"
                />
                <button 
                  type="submit"
                  disabled={!input.trim()}
                  className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-500 disabled:opacity-50 disabled:bg-gray-800 transition-colors shadow-lg flex-shrink-0"
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
