import { useEffect, useState } from 'react';

// 与 Tailwind 的 lg 断点保持一致：小于 1024px 视为移动端。
// 用 JS 判断而不是纯 CSS，是为了让被隐藏的控件不进入 DOM，避免同一操作出现两个入口。
const MOBILE_MAX_WIDTH = 1024;

function readIsMobile(): boolean {
  return typeof window === 'undefined' ? false : window.innerWidth < MOBILE_MAX_WIDTH;
}

export default function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(readIsMobile);

  useEffect(() => {
    const handleViewportChange = () => setIsMobile(readIsMobile());
    window.addEventListener('resize', handleViewportChange);
    return () => window.removeEventListener('resize', handleViewportChange);
  }, []);

  return isMobile;
}
