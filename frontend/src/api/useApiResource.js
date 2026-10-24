import { useCallback, useEffect, useRef, useState } from 'react'
import { subscribeToClinicChanges } from './client.js'

export default function useApiResource(loader, dependencies = []) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const hasLoaded = useRef(false)
  const refresh = useCallback(async () => {
    if (!hasLoaded.current) setLoading(true)
    try {
      const response = await loader()
      setResult(response)
      setError('')
      return response
    } catch (requestError) {
      setError(requestError.message || 'Unable to load data from the server.')
      throw requestError
    } finally {
      hasLoaded.current = true
      setLoading(false)
    }
  // `dependencies` are the resource's explicit request parameters.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)
  useEffect(() => {
    refresh().catch(() => {})
    return subscribeToClinicChanges(() => { refresh().catch(() => {}) })
  }, [refresh])
  return { result, loading, error, refresh, setResult }
}
