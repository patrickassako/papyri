import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';
import MiniPlayer from './MiniPlayer';
import { useAudioPlayer } from '../hooks/useAudioPlayer';

export default function Layout() {
  const { content } = useAudioPlayer();
  const hasMiniPlayer = !!content;

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <Box sx={{ pb: hasMiniPlayer ? '100px' : 0 }}>
        <Outlet />
      </Box>
      <MiniPlayer />
    </Box>
  );
}
