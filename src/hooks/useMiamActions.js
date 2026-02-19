import { useEffect, useRef } from 'react'
import { useMiam } from '../contexts/MiamContext'

export function useMiamActions(actions) {
  const { registerActions } = useMiam()
  const actionsRef = useRef(actions)

  useEffect(() => {
    actionsRef.current = actions
  })

  useEffect(() => {
    return registerActions(actionsRef.current)
  }, [registerActions])
}
