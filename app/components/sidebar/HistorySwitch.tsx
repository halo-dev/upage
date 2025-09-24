import { memo, useEffect, useState } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import { toggleSidebar } from '~/lib/stores/sidebar';

interface HistorySwitchProps {
  className?: string;
}

export const HistorySwitch = memo(({ className }: HistorySwitchProps) => {
  const [domLoaded, setDomLoaded] = useState(false);

  useEffect(() => {
    setDomLoaded(true);
  }, []);

  return (
    domLoaded && (
      <IconButton className={className} title="查看历史" onClick={toggleSidebar}>
        <div className="i-mingcute:history-line text-xl"></div>
      </IconButton>
    )
  );
});
