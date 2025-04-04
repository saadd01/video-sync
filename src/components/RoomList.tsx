import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Video, Copy, Upload } from 'lucide-react';

interface Room {
  _id: string;
  name: string;
  videoUrl: string;
  isLocalFile: boolean;
  localFilePath: string;
  pin: string;
  creator: {
    username: string;
    _id: string;
  };
}

const RoomList = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomUrl, setNewRoomUrl] = useState('');
  const [newRoomPin, setNewRoomPin] = useState('');
  const [createdRoomPin, setCreatedRoomPin] = useState<string | null>(null);
  const [isLocalFile, setIsLocalFile] = useState(false);
  const [localFilePath, setLocalFilePath] = useState('');
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/rooms`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setRooms(data);
      } else if (response.status === 401) {
        logout();
        navigate('/login');
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newRoomName,
          videoUrl: isLocalFile ? '' : newRoomUrl,
          isLocalFile,
          localFilePath,
          pin: newRoomPin
        })
      });
      if (response.ok) {
        const data = await response.json();
        setCreatedRoomPin(newRoomPin);
        setShowCreateModal(false);
        setNewRoomName('');
        setNewRoomUrl('');
        setNewRoomPin('');
        setIsLocalFile(false);
        setLocalFilePath('');
        fetchRooms();
      }
    } catch (error) {
      console.error('Error creating room:', error);
    }
  };

  const copyPinToClipboard = (pin: string) => {
    navigator.clipboard.writeText(pin);
    alert('PIN copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">Watch Rooms</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition duration-200"
          >
            <Plus className="w-5 h-5" />
            Create Room
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map((room) => (
            <div
              key={room._id}
              className="bg-gray-800 rounded-lg p-6 hover:bg-gray-700 transition duration-200"
            >
              <div className="flex items-center gap-4 mb-4">
                <Video className="w-8 h-8 text-blue-500" />
                <h2 className="text-xl font-semibold text-white">{room.name}</h2>
              </div>
              <p className="text-gray-400 mb-4">Created by: {room.creator.username}</p>
              <p className="text-gray-400 mb-4">
                Type: {room.isLocalFile ? 'Local File' : 'Online Video'}
              </p>
              {room.creator._id === JSON.parse(atob(token!.split('.')[1])).id && (
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-gray-400">Room PIN: {room.pin}</span>
                  <button
                    onClick={() => copyPinToClipboard(room.pin)}
                    className="text-blue-500 hover:text-blue-400"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              )}
              <button
                onClick={() => navigate(`/room/${room._id}`)}
                className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition duration-200"
              >
                Join Room
              </button>
            </div>
          ))}
        </div>

        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-gray-800 p-8 rounded-lg w-96">
              <h2 className="text-2xl font-bold text-white mb-6">Create New Room</h2>
              <form onSubmit={handleCreateRoom}>
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Room Name"
                    className="w-full p-3 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                  />
                </div>

                <div className="mb-4">
                  <label className="flex items-center text-white mb-2">
                    <input
                      type="checkbox"
                      checked={isLocalFile}
                      onChange={(e) => setIsLocalFile(e.target.checked)}
                      className="mr-2"
                    />
                    Use Local File
                  </label>
                </div>

                {isLocalFile ? (
                  <div className="mb-4">
                    <input
                      type="text"
                      placeholder="Local File Path (e.g., /path/to/video.mp4)"
                      className="w-full p-3 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
                      value={localFilePath}
                      onChange={(e) => setLocalFilePath(e.target.value)}
                    />
                    <p className="text-gray-400 text-sm mt-1">
                      Enter the absolute path to your video file
                    </p>
                  </div>
                ) : (
                  <div className="mb-4">
                    <input
                      type="text"
                      placeholder="Video URL"
                      className="w-full p-3 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
                      value={newRoomUrl}
                      onChange={(e) => setNewRoomUrl(e.target.value)}
                    />
                  </div>
                )}

                <div className="mb-6">
                  <input
                    type="text"
                    placeholder="Room PIN"
                    className="w-full p-3 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
                    value={newRoomPin}
                    onChange={(e) => setNewRoomPin(e.target.value)}
                  />
                </div>
                <div className="flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-500 text-white p-3 rounded hover:bg-blue-600 transition duration-200"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 bg-gray-600 text-white p-3 rounded hover:bg-gray-700 transition duration-200"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {createdRoomPin && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-gray-800 p-8 rounded-lg w-96">
              <h2 className="text-2xl font-bold text-white mb-4">Room Created Successfully!</h2>
              <p className="text-gray-300 mb-6">
                Your room PIN is: <span className="font-bold text-blue-500">{createdRoomPin}</span>
                <br />
                Save this PIN to share with others.
              </p>
              <button
                onClick={() => {
                  copyPinToClipboard(createdRoomPin);
                  setCreatedRoomPin(null);
                }}
                className="w-full bg-blue-500 text-white p-3 rounded hover:bg-blue-600 transition duration-200"
              >
                Copy PIN and Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoomList;