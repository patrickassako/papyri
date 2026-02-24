import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router'
import {
  Box,
  Button,
  Input,
  Text,
  Pagination,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@adminjs/design-system'
import { ApiClient } from 'adminjs'

const api = new ApiClient()

const PLACEHOLDER_COVER = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="160" viewBox="0 0 120 160">' +
  '<rect width="120" height="160" fill="#2E4057"/>' +
  '<text x="60" y="85" text-anchor="middle" fill="#D4A017" font-size="14" font-family="sans-serif">Pas de</text>' +
  '<text x="60" y="105" text-anchor="middle" fill="#D4A017" font-size="14" font-family="sans-serif">couverture</text>' +
  '</svg>'
)

const ContentsGrid = (props) => {
  const { resource } = props
  const location = useLocation()
  const navigate = useNavigate()

  const [viewMode, setViewMode] = useState('grid')
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const perPage = 12
  const timerRef = useRef(null)

  // Read search from URL
  const params0 = new URLSearchParams(location.search)
  const [searchQuery, setSearchQuery] = useState(params0.get('filters.__search') || '')

  const fetchRecords = async (pageNum) => {
    setLoading(true)
    try {
      const params = new URLSearchParams(location.search)
      params.set('page', String(pageNum))
      params.set('perPage', String(perPage))

      const response = await api.resourceAction({
        resourceId: resource.id,
        actionName: 'list',
        params: Object.fromEntries(params),
      })

      setRecords(response.data.records || [])
      setTotal(response.data.meta?.total || 0)
    } catch (err) {
      console.error('Fetch error:', err)
    }
    setLoading(false)
  }

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const p = parseInt(params.get('page') || '1', 10)
    setPage(p)
    // Sync search input from URL
    setSearchQuery(params.get('filters.__search') || '')
    fetchRecords(p)
  }, [location.search])

  const handleSearch = useCallback((e) => {
    const val = e.target.value
    setSearchQuery(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const params = new URLSearchParams(location.search)
      if (val.trim()) {
        params.set('filters.__search', val.trim())
      } else {
        params.delete('filters.__search')
      }
      params.set('page', '1')
      navigate({ search: params.toString() }, { replace: true })
    }, 400)
  }, [location.search, navigate])

  const handlePageChange = (newPage) => {
    const params = new URLSearchParams(location.search)
    params.set('page', String(newPage))
    navigate({ search: params.toString() })
  }

  const goToRecord = (id) => {
    navigate(`/admin/resources/contents/records/${id}/show`)
  }

  const totalPages = Math.ceil(total / perPage)

  // ─── Grid View ──────────────────────────────────────────
  const renderGrid = () => (
    <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
      {records.map((record) => {
        const p = record.params || {}
        const cover = p.cover_url || PLACEHOLDER_COVER
        const typeBadge = p.content_type === 'audiobook'
          ? { label: 'Audio', bg: '#D4A017' }
          : { label: 'Ebook', bg: '#2E4057' }

        return (
          <Box
            key={p.id}
            onClick={() => goToRecord(p.id)}
            style={{
              cursor: 'pointer',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              overflow: 'hidden',
              background: '#fff',
              transition: 'box-shadow 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)' }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)' }}
          >
            <Box style={{ position: 'relative' }}>
              <img
                src={cover}
                alt={p.title}
                style={{
                  width: '100%',
                  height: '220px',
                  objectFit: 'cover',
                  display: 'block',
                }}
                onError={(e) => { e.target.src = PLACEHOLDER_COVER }}
              />
              <Box style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                background: typeBadge.bg,
                color: '#fff',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 'bold',
              }}>
                {typeBadge.label}
              </Box>
              {!p.is_published && (
                <Box style={{
                  position: 'absolute',
                  top: '8px',
                  left: '8px',
                  background: '#e74c3c',
                  color: '#fff',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                }}>
                  Non publie
                </Box>
              )}
            </Box>
            <Box p="md">
              <Text style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px', lineHeight: '1.3' }}>
                {p.title || 'Sans titre'}
              </Text>
              <Text style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                {p.author || 'Auteur inconnu'}
              </Text>
              <Box style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <Text style={{
                  fontSize: '11px',
                  background: '#f0f0f0',
                  padding: '1px 6px',
                  borderRadius: '3px',
                }}>
                  {(p.format || '').toUpperCase()}
                </Text>
                <Text style={{
                  fontSize: '11px',
                  background: '#f0f0f0',
                  padding: '1px 6px',
                  borderRadius: '3px',
                }}>
                  {p.language || '?'}
                </Text>
              </Box>
            </Box>
          </Box>
        )
      })}
    </Box>
  )

  // ─── List View (table) ──────────────────────────────────
  const renderList = () => (
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>Couverture</TableCell>
          <TableCell>Titre</TableCell>
          <TableCell>Auteur</TableCell>
          <TableCell>Type</TableCell>
          <TableCell>Format</TableCell>
          <TableCell>Langue</TableCell>
          <TableCell>Publie</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {records.map((record) => {
          const p = record.params || {}
          const cover = p.cover_url || PLACEHOLDER_COVER
          return (
            <TableRow
              key={p.id}
              onClick={() => goToRecord(p.id)}
              style={{ cursor: 'pointer' }}
            >
              <TableCell>
                <img
                  src={cover}
                  alt=""
                  style={{ width: '40px', height: '55px', objectFit: 'cover', borderRadius: '3px' }}
                  onError={(e) => { e.target.src = PLACEHOLDER_COVER }}
                />
              </TableCell>
              <TableCell><Text style={{ fontWeight: 'bold' }}>{p.title}</Text></TableCell>
              <TableCell>{p.author}</TableCell>
              <TableCell>{p.content_type}</TableCell>
              <TableCell>{(p.format || '').toUpperCase()}</TableCell>
              <TableCell>{p.language}</TableCell>
              <TableCell>{p.is_published ? 'Oui' : 'Non'}</TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )

  return (
    <Box>
      {/* Search Bar */}
      <Box mb="lg">
        <Input
          value={searchQuery}
          onChange={handleSearch}
          placeholder="Rechercher par titre ou auteur..."
          style={{
            width: '100%',
            maxWidth: '500px',
            fontSize: '15px',
            padding: '10px 14px',
            borderRadius: '8px',
            border: '2px solid #e0e0e0',
          }}
        />
      </Box>

      {/* Toolbar */}
      <Box flex flexDirection="row" justifyContent="space-between" alignItems="center" mb="xl">
        <Text style={{ fontSize: '14px', color: '#666' }}>
          {total} contenu{total > 1 ? 's' : ''}
          {searchQuery && ` pour "${searchQuery}"`}
        </Text>
        <Box flex flexDirection="row" style={{ gap: '8px' }}>
          <Button
            variant={viewMode === 'grid' ? 'primary' : 'text'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            Grille
          </Button>
          <Button
            variant={viewMode === 'list' ? 'primary' : 'text'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            Liste
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/admin/resources/contents/actions/new')}
          >
            + Nouveau contenu
          </Button>
        </Box>
      </Box>

      {/* Content */}
      {loading ? (
        <Box p="xxl" style={{ textAlign: 'center' }}>
          <Text>Chargement...</Text>
        </Box>
      ) : records.length === 0 ? (
        <Box p="xxl" style={{ textAlign: 'center' }}>
          <Text>Aucun contenu trouve.</Text>
        </Box>
      ) : viewMode === 'grid' ? renderGrid() : renderList()}

      {/* Pagination */}
      {totalPages > 1 && (
        <Box mt="xl" flex justifyContent="center">
          <Pagination
            page={page}
            perPage={perPage}
            total={total}
            onChange={handlePageChange}
          />
        </Box>
      )}
    </Box>
  )
}

export default ContentsGrid
