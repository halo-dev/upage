import { memo } from 'react';
import { IconButton } from '~/.client/components/ui/IconButton';

interface SettingsButtonProps {
  onClick: () => void;
}

export const SettingsButton = memo(({ onClick }: SettingsButtonProps) => {
  return (
    <IconButton
      onClick={onClick}
      icon="i-ph:gear"
      size="xl"
      title="Settings"
      data-testid="settings-button"
      className="text-[#666] hover:text-upage-elements-textPrimary hover:bg-upage-elements-item-backgroundActive/10 transition-colors"
    />
  );
});
