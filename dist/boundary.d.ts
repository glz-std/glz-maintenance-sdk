import { Component, type ReactNode } from 'react';
interface Props {
    children: ReactNode;
    /** UI alternativa al romperse. Por defecto, un aviso sobrio. */
    fallback?: ReactNode;
}
interface State {
    fallo: boolean;
}
export declare class MaintenanceBoundary extends Component<Props, State> {
    state: State;
    static getDerivedStateFromError(): State;
    componentDidCatch(error: Error): void;
    render(): ReactNode;
}
export {};
