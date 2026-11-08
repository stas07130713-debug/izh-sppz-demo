/** Значок вида оборудования в разметке. Источник знака — один на всю программу. */
import { useState } from 'react';
import {
  builtInElementIconSource, elementIconFallback, elementIconSource,
} from './element-icon-source';

export interface ElementIconProps {
  readonly typeCode: string;
  readonly size?: 'plan' | 'normal' | 'large';
}

export function ElementIcon({ typeCode, size = 'normal' }: ElementIconProps): React.JSX.Element {
  const [failedSources, setFailedSources] = useState<readonly string[]>([]);
  const preferred = elementIconSource(typeCode);
  const builtIn = builtInElementIconSource(typeCode);
  const source = [preferred, builtIn]
    .find((candidate) => candidate !== null && !failedSources.includes(candidate)) ?? null;
  if (source !== null) {
    return (
      <span className={`element-icon element-icon-${size}`}>
        <img
          src={source}
          alt=""
          draggable={false}
          onError={() => setFailedSources((current) => current.includes(source) ? current : [...current, source])}
        />
      </span>
    );
  }

  const fallback = elementIconFallback(typeCode);
  return <span className="element-mark" style={{ background: fallback.color }}>{fallback.mark}</span>;
}
