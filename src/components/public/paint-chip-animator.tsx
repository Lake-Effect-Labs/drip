'use client';

import { useEffect, useState } from 'react';

const SHERWIN_WILLIAMS_COLORS = [
  { name: 'Agreeable Gray', hex: '#D1CCC4', accent: '#B8B2A7' },
  { name: 'Repose Gray', hex: '#C8C5BE', accent: '#B0ADA5' },
  { name: 'Worldly Gray', hex: '#D0CCC7', accent: '#B8B3AD' },
  { name: 'Mindful Gray', hex: '#BDB8B0', accent: '#A59F96' },
  { name: 'Sea Salt', hex: '#C5D4C5', accent: '#AEC0AE' },
  { name: 'Alabaster', hex: '#F3EDE5', accent: '#E8DFD3' },
  { name: 'Greek Villa', hex: '#F0EBE0', accent: '#DDD4C5' },
  { name: 'Accessible Beige', hex: '#D4CFC4', accent: '#C4BDB0' },
  { name: 'Drift of Mist', hex: '#E8E3DB', accent: '#D9D2C7' },
  { name: 'Naval', hex: '#1F3A5F', accent: '#2A4D7A' },
  { name: 'Evergreen Fog', hex: '#95978A', accent: '#7D8070' },
  { name: 'Iron Ore', hex: '#434343', accent: '#5A5A5A' },
  { name: 'Urbane Bronze', hex: '#54504A', accent: '#6B665E' },
  { name: 'Hale Navy', hex: '#2D3A4B', accent: '#3D4D63' },
  { name: 'Watery', hex: '#A4D4D4', accent: '#8FC4C4' },
  { name: 'Raindrops', hex: '#B1C4D4', accent: '#9BB0C2' },
  { name: 'Jade Dragon', hex: '#5A7D5A', accent: '#6B9070' },
  { name: 'Sage Green', hex: '#9CAF88', accent: '#8A9D76' },
  { name: 'Peppercorn', hex: '#6C6C6C', accent: '#7D7D7D' },
  { name: 'Colonel Sanders', hex: '#8B6F47', accent: '#9D7F57' },
  { name: 'Copper Penny', hex: '#AD6F69', accent: '#BD7F79' },
  { name: 'Coral Reef', hex: '#D9776B', accent: '#E1877B' },
];

export function PaintChipAnimator() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);
      
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % SHERWIN_WILLIAMS_COLORS.length);
        setIsTransitioning(false);
      }, 1000);
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  const currentColor = SHERWIN_WILLIAMS_COLORS[currentIndex];

  // Apply theme to CSS variables
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--theme-transition', '2s ease-in-out');
    root.style.setProperty('--theme-primary', currentColor.hex);
    root.style.setProperty('--theme-accent', currentColor.accent);
  }, [currentColor]);

  return (
    <>
      {/* Background gradient overlay */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 transition-opacity duration-[2000ms]"
        style={{
          background: `linear-gradient(135deg, 
            ${currentColor.hex}08 0%, 
            ${currentColor.hex}15 50%, 
            ${currentColor.accent}12 100%)`,
          opacity: isTransitioning ? 0.6 : 1,
        }}
      />

      {/* Paint chip display */}
      <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 pointer-events-none z-10">
        <div className="flex items-center gap-2 sm:gap-3 bg-white/95 backdrop-blur-sm px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl shadow-lg border border-stone-200 transition-all duration-1000">
          {/* Paint chip */}
          <div
            className="relative w-10 h-8 sm:w-16 sm:h-12 rounded-md sm:rounded-lg shadow-md transition-all duration-[2000ms] transform"
            style={{
              backgroundColor: currentColor.hex,
              transform: isTransitioning ? 'scale(0.95) rotate(-2deg)' : 'scale(1) rotate(0deg)',
            }}
          >
            {/* Shine effect */}
            <div className="absolute inset-0 rounded-md sm:rounded-lg bg-gradient-to-br from-white/40 via-transparent to-transparent" />
          </div>

          {/* Color name */}
          <div className="flex flex-col">
            <span className="text-[10px] sm:text-xs text-stone-500 font-medium">Sherwin-Williams</span>
            <span
              className="text-xs sm:text-sm font-semibold text-stone-800 transition-opacity duration-500"
              style={{
                opacity: isTransitioning ? 0.5 : 1,
              }}
            >
              {currentColor.name}
            </span>
          </div>
        </div>
      </div>

      {/* Global styles for theme colors */}
      <style dangerouslySetInnerHTML={{ __html: `
        .themed-button {
          background-color: var(--theme-primary) !important;
          transition: background-color var(--theme-transition), transform 0.2s !important;
        }
        
        .themed-button:hover {
          background-color: var(--theme-accent) !important;
          transform: translateY(-1px);
        }

        .themed-badge {
          background-color: var(--theme-primary) !important;
          color: #1c1917 !important;
          transition: background-color var(--theme-transition) !important;
        }

        .themed-accent {
          color: var(--theme-accent) !important;
          transition: color var(--theme-transition) !important;
        }

        .themed-border {
          border-color: var(--theme-primary) !important;
          transition: border-color var(--theme-transition) !important;
        }
      `}} />
    </>
  );
}
