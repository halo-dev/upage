import * as Tooltip from '@radix-ui/react-tooltip';
import { useEffect, useState } from 'react';
import { useChatDeployment } from '~/lib/hooks/useChatDeployment';
import { DeploymentPlatformEnum } from '~/types/deployment';

export function NetlifyDeploymentLink() {
  const { getDeploymentByPlatform } = useChatDeployment();
  const [deploymentUrl, setDeploymentUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    setDeploymentUrl(getDeploymentByPlatform(DeploymentPlatformEnum.NETLIFY)?.url || '');
  }, [getDeploymentByPlatform]);

  return (
    deploymentUrl && (
      <Tooltip.Provider>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <a
              href={deploymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center size-8 rounded hover:bg-upage-elements-item-backgroundActive text-upage-elements-textSecondary hover:text-[#00AD9F] z-50"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <div className="i-ph:link size-4 hover:text-blue-400" />
            </a>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              className="px-3 py-2 rounded bg-upage-elements-background-depth-3 text-upage-elements-textPrimary text-xs z-50"
              sideOffset={5}
            >
              {deploymentUrl}
              <Tooltip.Arrow className="fill-upage-elements-background-depth-3" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    )
  );
}
