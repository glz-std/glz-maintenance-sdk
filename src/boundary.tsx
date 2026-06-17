// ErrorBoundary de React que reporta a GLZ Maintenance y muestra un fallback sobrio
// (evita la pantalla blanca). React es peer dependency OPCIONAL: si no usas React,
// importa solo initMaintenance/reportarError de core.

import { Component, type ReactNode } from 'react'
import { reportarError } from './core.js'

interface Props {
  children: ReactNode
  /** UI alternativa al romperse. Por defecto, un aviso sobrio. */
  fallback?: ReactNode
}
interface State {
  fallo: boolean
}

export class MaintenanceBoundary extends Component<Props, State> {
  state: State = { fallo: false }

  static getDerivedStateFromError(): State {
    return { fallo: true }
  }

  componentDidCatch(error: Error): void {
    reportarError(error)
  }

  render(): ReactNode {
    if (this.state.fallo) {
      return (
        this.props.fallback ?? (
          <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', color: '#888' }}>
            Algo ha fallado. Se ha avisado a mantenimiento.
          </div>
        )
      )
    }
    return this.props.children
  }
}
