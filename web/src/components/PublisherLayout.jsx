import React, { useEffect, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import PublisherSidebar from './PublisherSidebar';
import { getMe } from '../services/publisher.service';
import * as authService from '../services/auth.service';

export default function PublisherLayout({ children }) {
  const [publisher, setPublisher] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [meRes, userRes] = await Promise.all([
          getMe(),
          authService.getUser(),
        ]);
        setPublisher(meRes.publisher);
        setUser(userRes);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: '220px 1fr',
      minHeight: '100vh',
      width: '100%',
      bgcolor: '#F5F5F5',
    }}>
      <PublisherSidebar publisher={publisher} user={user} />
      <Box sx={{ overflow: 'hidden', minWidth: 0, height: '100vh', overflowY: 'auto' }}>
        {React.cloneElement(children, { publisher, user })}
      </Box>
    </Box>
  );
}
