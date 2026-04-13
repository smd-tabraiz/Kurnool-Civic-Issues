import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);
export const useSocket = () => useContext(SocketContext);

const SOCKET_URL = 'http://localhost:5000';

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    const s = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    setSocket(s);

    s.on('connect', () => console.log('🔌 Socket connected'));
    s.on('disconnect', () => console.log('🔌 Socket disconnected'));

    return () => { s.disconnect(); };
  }, []);

  useEffect(() => {
    if (socket && user?._id) {
      socket.emit('joinRoom', user._id);
    }
  }, [socket, user]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};
