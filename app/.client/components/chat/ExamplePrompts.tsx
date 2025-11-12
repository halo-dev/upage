import React from 'react';

const EXAMPLE_PROMPTS = [
  { text: '帮我生成一个公司的官网，展示公司的产品，突出公司的优势' },
  { text: '创建个人使用的落地页，展示我的作品以及联系方式' },
  { text: '制作一个漂亮的头像卡片' },
  { text: '制作一个登录表单' },
  { text: '使用 Tailwind CSS 制作一个响应式的导航栏' },
];

export function ExamplePrompts({
  sendMessage,
}: {
  sendMessage: (event: React.UIEvent, messageInput?: string) => void;
}) {
  return (
    <div id="examples" className="relative flex flex-col gap-9 w-full max-w-3xl mx-auto flex justify-center mt-6">
      <div
        className="flex flex-wrap justify-center gap-2"
        style={{
          animation: '.25s ease-out 0s 1 _fade-and-move-in_g2ptj_1 forwards',
        }}
      >
        {EXAMPLE_PROMPTS.map((examplePrompt, index: number) => {
          return (
            <button
              key={index}
              onClick={(event) => {
                sendMessage?.(event, examplePrompt.text);
              }}
              className="border border-upage-elements-borderColor rounded-full bg-gray-50 hover:bg-gray-100 dark:bg-gray-950 dark:hover:bg-gray-900 text-upage-elements-textSecondary hover:text-upage-elements-textPrimary px-3 py-1 text-xs transition-theme transition-text-color transition-background transition-border"
            >
              {examplePrompt.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
