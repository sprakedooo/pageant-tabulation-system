import { useEffect, useState } from 'react';
import { getSocket } from '../socket';

// Shows a banner when the LAN connection to the server is lost.
export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    const onDisconnect = () => setOffline(true);
    const onConnect = () => setOffline(false);
    socket.on('disconnect', onDisconnect);
    socket.on('connect', onConnect);
    return () => {
      socket.off('disconnect', onDisconnect);
      socket.off('connect', onConnect);
    };
  }, []);

  if (!offline) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-50 bg-red-600 text-white text-center text-sm font-semibold py-2 animate-pulse">
      ⚠ Connection to the tabulation server lost — check the LAN cable / Wi-Fi. Reconnecting…
    </div>
  );
}
