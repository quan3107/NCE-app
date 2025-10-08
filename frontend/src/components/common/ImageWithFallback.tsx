/**
 * Location: components/common/ImageWithFallback.tsx
 * Purpose: Render the Image With Fallback component within the Common layer.
 * Why: Supports reuse under the refactored frontend structure.
 */

import { ImgHTMLAttributes, useState } from 'react';

const ERROR_IMG_SRC =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODgiIGhlaWdodD0iODgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgc3Ryb2tlPSIjMDAwIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBvcGFjaXR5PSIuMyIgZmlsbD0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIzLjciPjxyZWN0IHg9IjE2IiB5PSIxNiIgd2lkdGg9IjU2IiBoZWlnaHQ9IjU2IiByeD0iNiIvPjxwYXRoIGQ9Im0xNiA1OCAxNi0xOCAzMiAzMiIvPjxjaXJjbGUgY3g9IjUzIiBjeT0iMzUiIHI9IjciLz48L3N2Zz4KCg==';

type ImageWithFallbackProps = ImgHTMLAttributes<HTMLImageElement>;

export function ImageWithFallback({ src, alt, ...rest }: ImageWithFallbackProps) {
  const [didError, setDidError] = useState(false);

  if (!src || didError) {
    return <img {...rest} src={ERROR_IMG_SRC} alt={alt ?? 'Fallback image'} />;
  }

  return (
    <img
      {...rest}
      src={src}
      alt={alt}
      onError={() => setDidError(true)}
      data-original-url={src}
    />
  );
}





