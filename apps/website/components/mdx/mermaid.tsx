'use client';

import { useTheme } from 'next-themes';
import mermaid from 'mermaid';
import { useEffect, useId, useState } from 'react';

export interface MermaidProps {
  chart: string;
}

export function Mermaid({ chart }: MermaidProps): React.ReactElement {
  const id = useId();
  const { resolvedTheme } = useTheme();
  const [svg, setSvg] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    // Initialize mermaid with current theme
    mermaid.initialize({
      startOnLoad: false,
      theme: resolvedTheme === 'dark' ? 'dark' : 'default',
      securityLevel: 'loose',
    });

    // Render the chart
    void mermaid
      .render(`mermaid-${id}`, chart)
      .then((result) => {
        setSvg(result.svg);
        setError(undefined);
        return result;
      })
      .catch((e) => {
        console.error('Mermaid render error:', e);
        setError(e.message || 'Failed to render diagram');
      });
  }, [id, chart, resolvedTheme]);

  if (error) {
    return (
      <div className="flex items-center justify-center p-4 border border-red-500 rounded">
        <div className="text-sm text-red-500">Error rendering diagram: {error}</div>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-sm text-muted-foreground">Loading diagram...</div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center [&_svg]:max-w-full [&_svg]:h-auto my-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
