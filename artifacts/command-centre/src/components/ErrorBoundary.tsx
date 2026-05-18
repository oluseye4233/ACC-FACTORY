import { Component, type ErrorInfo, type ReactNode } from "react";
import * as Sentry from "@sentry/react";

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
    // eslint-disable-next-line no-console
    console.error("Render error:", error, info);
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background p-8">
        <div className="max-w-md text-center space-y-4">
          <h1 className="font-display tracking-widest text-2xl text-destructive">SYSTEM FAULT</h1>
          <p className="font-mono text-sm text-muted-foreground">
            The interface encountered an unrecoverable error. The incident has been recorded.
          </p>
          <pre className="text-xs text-left text-muted-foreground/70 bg-card border border-border rounded p-3 overflow-auto">
            {this.state.error?.message ?? "Unknown error"}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="font-display tracking-wider text-sm px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            RELOAD
          </button>
        </div>
      </div>
    );
  }
}
