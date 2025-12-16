import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { createScopedLogger } from '~/.client/utils/logger';

const logger = createScopedLogger('usePromptEnhancement');

export function usePromptEnhancer() {
  const { messages, sendMessage } = useChat<UIMessage>({
    transport: new DefaultChatTransport({
      api: '/api/enhancer',
    }),
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error(`提示词优化失败: ${errorMessage}`);
      toast.error('提示词优化失败');
    },
    onFinish: () => {
      setIsLoading(false);
      toast.success('提示词优化成功');
    },
  });

  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant' && lastMessage.parts) {
        const content = lastMessage.parts.find((part) => part.type === 'text')?.text;
        setEnhancedInput(content || '');
      }
    }
  }, [messages]);

  const [isLoading, setIsLoading] = useState(false);
  const [enhancedInput, setEnhancedInput] = useState('');

  const resetEnhancer = () => {
    setIsLoading(false);
    setEnhancedInput('');
  };

  const enhancePrompt = async (originalInput: string) => {
    setIsLoading(true);
    sendMessage({
      text: originalInput,
    });
  };

  return { enhancedInput, isLoading, enhancePrompt, resetEnhancer };
}
