/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  tutorialSidebar: [
    {
      type: 'doc',
      id: 'index',
      label: '首页',
    },
    {
      type: 'doc',
      id: 'quick-start',
      label: '快速开始',
    },
    {
      type: 'category',
      label: '部署指南',
      link: {
        type: 'generated-index',
        title: '部署指南',
        slug: 'deployment-guide',
      },
      items: [
        'deployment/docker',
        'deployment/docker-compose',
        'deployment/source',
        'deployment/logto',
        'deployment/others',
      ],
    },
    {
      type: 'doc',
      id: 'configuration',
      label: '配置参考',
    },
    {
      type: 'category',
      label: '用户指南',
      link: {
        type: 'generated-index',
        title: '用户指南',
        slug: 'user-guide',
      },
      items: [
        'user-guide/basics',
        'user-guide/ai-page-generation',
        'user-guide/page-management',
      ],
    },
    {
      type: 'doc',
      id: 'contributing',
      label: '贡献指南',
    },
    {
      type: 'doc',
      id: 'faq',
      label: '常见问题',
    },
    {
      type: 'doc',
      id: 'changelog',
      label: '更新日志',
    },
  ],
};

module.exports = sidebars;
