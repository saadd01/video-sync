import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import RoomList from './components/RoomList';
import Room from './components/Room';
import PrivateRoute from './components/PrivateRoute';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-900">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/rooms" element={
              <PrivateRoute>
                <RoomList />
              </PrivateRoute>
            } />
            <Route path="/room/:id" element={
              <PrivateRoute>
                <Room />
              </PrivateRoute>
            } />
            <Route path="/" element={<Navigate to="/rooms" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;