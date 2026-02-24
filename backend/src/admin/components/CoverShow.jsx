import React from 'react'
import { Box, Text } from '@adminjs/design-system'

const PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="240" viewBox="0 0 180 240">' +
  '<rect width="180" height="240" fill="#2E4057"/>' +
  '<text x="90" y="115" text-anchor="middle" fill="#D4A017" font-size="16" font-family="sans-serif">Pas de</text>' +
  '<text x="90" y="140" text-anchor="middle" fill="#D4A017" font-size="16" font-family="sans-serif">couverture</text>' +
  '</svg>'
)

const CoverShow = (props) => {
  const { record, property } = props
  const url = record.params[property.path]

  return (
    <Box mb="lg">
      <Text style={{ fontSize: '12px', color: '#666', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 'bold' }}>
        {property.label || 'Couverture'}
      </Text>
      <Box style={{ display: 'inline-block' }}>
        <img
          src={url || PLACEHOLDER}
          alt="Couverture"
          onError={(e) => { e.target.src = PLACEHOLDER }}
          style={{
            maxWidth: '200px',
            maxHeight: '280px',
            borderRadius: '6px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            display: 'block',
          }}
        />
        {url && (
          <Text style={{ fontSize: '11px', color: '#999', marginTop: '6px', wordBreak: 'break-all' }}>
            {url}
          </Text>
        )}
      </Box>
    </Box>
  )
}

export default CoverShow
