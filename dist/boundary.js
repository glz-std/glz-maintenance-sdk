import { jsx as _jsx } from "react/jsx-runtime";
// ErrorBoundary de React que reporta a GLZ Maintenance y muestra un fallback sobrio
// (evita la pantalla blanca). React es peer dependency OPCIONAL: si no usas React,
// importa solo initMaintenance/reportarError de core.
import { Component } from 'react';
import { reportarError } from './core.js';
export class MaintenanceBoundary extends Component {
    state = { fallo: false };
    static getDerivedStateFromError() {
        return { fallo: true };
    }
    componentDidCatch(error) {
        reportarError(error);
    }
    render() {
        if (this.state.fallo) {
            return (this.props.fallback ?? (_jsx("div", { style: { padding: 24, fontFamily: 'system-ui, sans-serif', color: '#888' }, children: "Algo ha fallado. Se ha avisado a mantenimiento." })));
        }
        return this.props.children;
    }
}
