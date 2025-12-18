import { useEffect, useState } from 'react';
import { Outlet } from 'react-router';
import { Header } from '~/.client/components/layouts/Header';
import { Menu } from '~/.client/components/sidebar/Menu';

export default function AppLayout() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="flex flex-col size-full">
      <Header isScrolled={isScrolled} className="sticky top-0 h-[var(--header-height)] z-50" />
      <Menu className="absolute left-0 bottom-0 top-[var(--header-height)] h-[calc(100vh - var(--header-height))]" />

      <main className="relative flex flex-col flex-1">
        <Outlet />
      </main>
    </div>
  );
}
