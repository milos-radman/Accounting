import { Component, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

type FailureProps = {
  error: unknown;
  title?: string;
  message?: string;
  onRetry?: () => void;
  componentStack?: string;
};

export function AppFailure({ error, title = 'Accounting is temporarily unavailable', message = 'We could not load the demo data. Check that the database is available, then try again.', onRetry, componentStack }: FailureProps) {
  const [copied, setCopied] = useState(false);
  const details = error instanceof Error && 'details' in error ? (error as Error & { details: unknown }).details : undefined;
  const report = JSON.stringify({
    timeUtc: new Date().toISOString(),
    page: window.location.href,
    browser: navigator.userAgent,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
    server: details,
    componentStack,
  }, null, 2);

  return <main className="failure-page" role="alert">
    <section className="failure-card">
      <div className="failure-mark" aria-hidden="true">!</div>
      <p className="failure-kicker">Accounting demo</p>
      <h1>{title}</h1>
      <p>{message}</p>
      {onRetry && <button className="btn primary" onClick={onRetry}>Try again</button>}
      <details className="failure-details">
        <summary>Technical details for support or AI</summary>
        <p>Copy this report when asking someone to investigate. It excludes database credentials.</p>
        <button className="btn small" onClick={() => {
          void navigator.clipboard?.writeText(report).then(() => setCopied(true)).catch(() => setCopied(false));
        }}>{copied ? 'Copied' : 'Copy details'}</button>
        <pre>{report}</pre>
      </details>
    </section>
  </main>;
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null; info?: ErrorInfo }> {
  state: { error: Error | null; info?: ErrorInfo } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ error, info });
  }

  render() {
    return this.state.error
      ? <AppFailure error={this.state.error} title="Accounting could not start" message="The page hit an unexpected error while starting. You can reload and share the technical report if it continues." componentStack={this.state.info?.componentStack ?? undefined} />
      : this.props.children;
  }
}
