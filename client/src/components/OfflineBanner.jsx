import { useEffect, useState } from 'react';
import { getSocket } from '../socket';
import { useAuth } from '../context/AuthContext';

// Shows a banner when the LAN connection to the server is lost.
export default function OfflineBanner() {
  const { user } = useAuth();
  const [offline, setOffline] = useState(false);

  // Re-subscribe whenever the user changes: login/logout swaps the socket
  // instance, and listeners on the old (disconnected) one would show a
  // false "connection lost" banner.
  useEffect(() => {
    setOffline(false);
    const socket = getSocket();
    const onDisconnect = () => setOffline(true);
    const onConnect = () => setOffline(false);
    socket.on('disconnect', onDisconnect);
    socket.on('connect', onConnect);
    return () => {
      socket.off('disconnect', onDisconnect);
      socket.off('connect', onConnect);
    };
  }, [user]);

  if (!offline) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-50 bg-red-600 text-white text-center text-sm font-semibold py-2 animate-pulse">
      ⚠ Connection to the tabulation server lost — check the LAN cable / Wi-Fi. Reconnecting…
    </div>
  );
}
