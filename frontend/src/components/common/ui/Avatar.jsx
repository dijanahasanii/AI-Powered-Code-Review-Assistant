import { useState } from 'react';

export const Avatar = ({ src, alt, size = 28 }) => {
  const safeAlt = typeof alt === 'string' && alt.trim() ? alt.trim() : 'Account';
  const initials = safeAlt ? safeAlt.slice(0, 2).toUpperCase() : '?';
  const [imgFailed, setImgFailed] = useState(false);
  const showInitials = !src || imgFailed;

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-800"
      style={{ width: size, height: size }}
      title={safeAlt}
    >
      {!showInitials && (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImgFailed(true)}
        />
      )}
      {showInitials && (
        <span
          className="flex h-full w-full items-center justify-center rounded-full bg-brand-600 font-medium leading-none text-white"
          style={{ fontSize: size * 0.38 }}
          aria-hidden="true"
        >
          {initials}
        </span>
      )}
      <span className="sr-only">{safeAlt}</span>
    </span>
  );
};
