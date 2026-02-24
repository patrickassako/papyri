import React, { useState, useEffect, useRef } from 'react'
import { Input, Label, Box } from '@adminjs/design-system'
import { useNavigate, useLocation } from 'react-router'

const AutoSearchFilter = (props) => {
  const { property, filter } = props
  const filterKey = `filters.${property.path}`
  const location = useLocation()
  const navigate = useNavigate()
  const params = new URLSearchParams(location.search)
  const [value, setValue] = useState(params.get(filterKey) || '')
  const timerRef = useRef(null)

  useEffect(() => {
    // Sync from URL on mount/URL change
    const current = new URLSearchParams(location.search).get(filterKey) || ''
    setValue(current)
  }, [location.search, filterKey])

  const handleChange = (e) => {
    const val = e.target.value
    setValue(val)

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const newParams = new URLSearchParams(location.search)
      if (val.trim()) {
        newParams.set(filterKey, val.trim())
      } else {
        newParams.delete(filterKey)
      }
      newParams.set('page', '1')
      navigate({ search: newParams.toString() }, { replace: true })
    }, 400)
  }

  return (
    <Box mb="lg">
      <Label>{property.label || 'Recherche'}</Label>
      <Input
        value={value}
        onChange={handleChange}
        placeholder="Tapez pour rechercher..."
      />
    </Box>
  )
}

export default AutoSearchFilter
