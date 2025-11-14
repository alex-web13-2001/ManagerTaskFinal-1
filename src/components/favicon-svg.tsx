import React from 'react';

// SVG компонент для использования в качестве favicon или в других местах
export function FaviconSVG() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Основной градиент фона */}
      <defs>
        <linearGradient id="bgGradient" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="50%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#4338CA" />
        </linearGradient>
        <linearGradient id="overlayGradient" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="50%" stopColor="white" stopOpacity="0.1" />
          <stop offset="100%" stopColor="white" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      
      {/* Закругленный квадрат с градиентом */}
      <rect width="64" height="64" rx="14" fill="url(#bgGradient)" />
      
      {/* Оверлей для глубины */}
      <rect width="64" height="64" rx="14" fill="url(#overlayGradient)" />
      
      {/* Декоративные точки */}
      <circle cx="54" cy="10" r="3" fill="white" fillOpacity="0.4" />
      <circle cx="10" cy="54" r="2" fill="white" fillOpacity="0.3" />
      
      {/* Текст T24 */}
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        fill="white"
        fontSize="22"
        fontWeight="600"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        letterSpacing="-0.5"
      >
        T24
      </text>
    </svg>
  );
}

// Функция для генерации data URL для favicon
export function generateFaviconDataURL(): string {
  const svg = `
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGradient" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#3B82F6" />
          <stop offset="50%" stop-color="#2563EB" />
          <stop offset="100%" stop-color="#4338CA" />
        </linearGradient>
        <linearGradient id="overlayGradient" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="white" stop-opacity="0" />
          <stop offset="50%" stop-color="white" stop-opacity="0.1" />
          <stop offset="100%" stop-color="white" stop-opacity="0.2" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#bgGradient)" />
      <rect width="64" height="64" rx="14" fill="url(#overlayGradient)" />
      <circle cx="54" cy="10" r="3" fill="white" fill-opacity="0.4" />
      <circle cx="10" cy="54" r="2" fill="white" fill-opacity="0.3" />
      <text
        x="50%"
        y="50%"
        dominant-baseline="middle"
        text-anchor="middle"
        fill="white"
        font-size="22"
        font-weight="600"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        letter-spacing="-0.5"
      >T24</text>
    </svg>
  `.trim();
  
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
