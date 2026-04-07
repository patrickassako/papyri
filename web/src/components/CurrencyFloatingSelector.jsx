import React, { useState } from 'react';
import {
  Box,
  IconButton,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import CheckIcon from '@mui/icons-material/Check';
import { useCurrency } from '../hooks/useCurrency';

export default function CurrencyFloatingSelector({ sx = {} }) {
  const {
    currency,
    manualOverride,
    supportedCurrencies,
    setManualCurrency,
    clearManualCurrency,
  } = useCurrency();
  const [anchorEl, setAnchorEl] = useState(null);

  return (
    <>
      <Tooltip title={`Devise: ${manualOverride || `Auto (${currency})`}`} placement="left">
        <IconButton
          onClick={(event) => setAnchorEl(event.currentTarget)}
          sx={{
            position: 'fixed',
            right: { xs: 12, md: 18 },
            bottom: { xs: 86, md: 22 },
            zIndex: 40,
            width: 42,
            height: 42,
            bgcolor: 'rgba(255,255,255,0.92)',
            color: '#5f5342',
            border: '1px solid rgba(28,22,13,0.10)',
            boxShadow: '0 10px 26px rgba(0,0,0,0.08)',
            backdropFilter: 'blur(10px)',
            '&:hover': {
              bgcolor: '#fff',
            },
            ...sx,
          }}
        >
          <Box sx={{ display: 'grid', placeItems: 'center', lineHeight: 1 }}>
            <PaidOutlinedIcon sx={{ fontSize: 16 }} />
            <Typography sx={{ fontSize: '0.53rem', fontWeight: 800, mt: '-1px', letterSpacing: '0.04em' }}>
              {currency}
            </Typography>
          </Box>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        anchorOrigin={{ horizontal: 'left', vertical: 'center' }}
        slotProps={{
          paper: {
            elevation: 0,
            sx: {
              borderRadius: 3,
              minWidth: 170,
              border: '1px solid rgba(28,22,13,0.10)',
              boxShadow: '0 16px 40px rgba(0,0,0,0.12)',
              mt: -0.5,
            },
          },
        }}
      >
        <MenuItem
          onClick={() => {
            clearManualCurrency();
            setAnchorEl(null);
          }}
          sx={{ py: 1 }}
        >
          <ListItemText
            primary="Automatique"
            secondary={`Actuel: ${currency}`}
            primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 700 }}
            secondaryTypographyProps={{ fontSize: '0.72rem' }}
          />
          {!manualOverride && <CheckIcon sx={{ fontSize: 18, color: '#b5770c' }} />}
        </MenuItem>

        {supportedCurrencies.map((option) => (
          <MenuItem
            key={option.code}
            onClick={() => {
              setManualCurrency(option.code);
              setAnchorEl(null);
            }}
            sx={{ py: 1 }}
          >
            <ListItemText
              primary={option.code}
              secondary={option.label}
              primaryTypographyProps={{ fontSize: '0.88rem', fontWeight: 700 }}
              secondaryTypographyProps={{ fontSize: '0.72rem' }}
            />
            {manualOverride === option.code && <CheckIcon sx={{ fontSize: 18, color: '#b5770c' }} />}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
