import { IconButton } from '~/components/ui/IconButton';
import WithTooltip from '~/components/ui/Tooltip';

export const ExportChatButton = ({ exportChat }: { exportChat?: () => void }) => {
  return (
    <WithTooltip tooltip="导出聊天">
      <IconButton title="导出聊天" onClick={() => exportChat?.()}>
        <div className="i-ph:download-simple text-xl"></div>
      </IconButton>
    </WithTooltip>
  );
};
