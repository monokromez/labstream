import { useContext } from 'react'
import TechnologistContext from './TechnologistState.js'

export default function useTechnologist() {
  const context = useContext(TechnologistContext)
  if (!context) throw new Error('Medical technologist pages must be rendered inside TechnologistProvider.')
  return context
}
