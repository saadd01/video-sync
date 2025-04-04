import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import ReactPlayer from 'react-player';
import { Send, MessageSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Message {
  message: string;
  username: string;
  timestamp: string;
}

const Room = () => {
  const { id: roomId } = useParams<{ id: string }>();
  const [videoState, setVideoState] = useState({ isPlaying: false, currentTime: 0 });
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showChat, setShowChat] = useState(true);
  const [pin, setPin] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const socketRef = useRef<Socket>();
  const playerRef = useRef<ReactPlayer>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const { token } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isVerified) return;

    socketRef.current = io(import.meta.env.VITE_BACKEND_URL);
    socketRef.current.emit('join-room', roomId);

    socketRef.current.on('video-state-update', (newState) => {
      setVideoState(newState);
      if (playerRef.current) {
        playerRef.current.seekTo(newState.currentTime);
      }
    });

    socketRef.current.on('chat-message', (message) => {
      setMessages((prev) => [...prev, message]);
      if (chatRef.current) {
        chatRef.current.scrollTop = chatRef.current.scrollHeight;
      }
    });

    // Fetch existing messages
    const fetchMessages = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/rooms/${roomId}/messages`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setMessages(data);
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };

    fetchMessages();

    return () => {
      socketRef.current?.disconnect();
    };
  }, [roomId, isVerified, token]);

  const verifyPin = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/rooms/${roomId}/verify-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ pin })
      });
      
      if (response.ok) {
        const data = await response.json();
        setIsVerified(true);
        setVideoUrl(data.videoUrl);
      } else {
        alert('Invalid PIN');
      }
    } catch (error) {
      console.error('Error verifying PIN:', error);
    }
  };

  const handleVideoStateChange = (playing: boolean) => {
    const currentTime = playerRef.current?.getCurrentTime() || 0;
    const newState = { isPlaying: playing, currentTime };
    setVideoState(newState);
    socketRef.current?.emit('video-state-change', { roomId, videoState: newState });
  };

  const handleProgress = (state: { playedSeconds: number }) => {
    if (videoState.isPlaying) {
      socketRef.current?.emit('video-state-change', {
        roomId,
        videoState: { ...videoState, currentTime: state.playedSeconds }
      });
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() && token) {
      socketRef.current?.emit('chat-message', {
        roomId,
        message: newMessage,
        token
      });
      setNewMessage('');
    }
  };

  if (!isVerified) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-96">
          <h2 className="text-2xl font-bold text-white mb-6">Enter Room PIN</h2>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Enter PIN"
            className="w-full p-3 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none mb-4"
          />
          <button
            onClick={verifyPin}
            className="w-full bg-blue-500 text-white p-3 rounded hover:bg-blue-600 transition duration-200"
          >
            Join Room
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex">
      <div className={`flex-1 p-8 ${showChat ? 'mr-96' : ''}`}>
        <div className="aspect-w-16 aspect-h-9 bg-black rounded-lg overflow-hidden">
          <ReactPlayer
            ref={playerRef}
            url={videoUrl}
            width="100%"
            height="100%"
            playing={videoState.isPlaying}
            controls={true}
            onPlay={() => handleVideoStateChange(true)}
            onPause={() => handleVideoStateChange(false)}
            onProgress={handleProgress}
          />
        </div>
      </div>

      <div
        className={`fixed right-0 top-0 bottom-0 w-96 bg-gray-800 transform transition-transform duration-300 ${
          showChat ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <button
          onClick={() => setShowChat(!showChat)}
          className="absolute -left-12 top-4 bg-gray-800 p-3 rounded-l-lg"
        >
          <MessageSquare className="w-6 h-6 text-white" />
        </button>

        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-xl font-bold text-white">Chat</h2>
          </div>

          <div
            ref={chatRef}
            className="flex-1 overflow-y-auto p-4 space-y-4"
          >
            {messages.map((msg, index) => (
              <div key={index} className="bg-gray-700 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-blue-400">{msg.username}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-white">{msg.message}</p>
              </div>
            ))}
          </div>

          <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition duration-200"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Room;