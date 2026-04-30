import classNames from 'classnames';
import { useEffect, useState } from 'react';
import { Outlet, useMatches } from 'react-router';
import { Header } from '~/.client/components/layouts/Header';
import { Menu } from '~/.client/components/sidebar/Menu';

export default function AppLayout() {
  const matches = useMatches();
  /** 与 routes.ts 里 `route('chat/:id', ..., { id: 'chat' })` 对齐 */
  const isChatRoute = matches.some((m) => m.id === 'chat');
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

      <main className={classNames('relative flex flex-col flex-1', isChatRoute && 'min-h-0 overflow-hidden')}>
        <Outlet />
      </main>
    </div>
  );
}
