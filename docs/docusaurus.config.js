// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'UPage 文档',
  tagline: 'UPage 是一款基于人工智能的可视化网页构建平台',
  favicon: '../public/favicon.svg',

  // Set the production url of your site here
  url: 'https://docs.upage.ai',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'halo-dev', // Usually your GitHub org/user name.
  projectName: 'upage', // Usually your repo name.
  trailingSlash: false,

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internalization, you can use this field to set useful
  // metadata like html lang. For example, if your site is Chinese, you may want
  // to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'zh-Hans',
    locales: ['zh-Hans'],
  },

  future: {
    experimental_faster: true,
    v4: true,
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          path: 'content',
          routeBasePath: '/',
          sidebarPath: require.resolve('./sidebars.js'),
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/halo-dev/upage/edit/main/docs/content/',
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Replace with your project's social card
      image: 'img/social-card.png',
      navbar: {
        title: 'UPage',
        logo: {
          alt: 'UPage Logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: '使用文档',
          },
          {
            href: 'https://github.com/halo-dev/upage',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: '文档',
            items: [
              {
                label: '快速开始',
                to: '/quick-start',
              },
              {
                label: '部署指南',
                to: '/category/deployment-guide',
              },
            ],
          },
          {
            title: '社区',
            items: [
              {
                label: 'GitHub Issues',
                href: 'https://github.com/halo-dev/upage/issues',
              },
              {
                label: 'GitHub Discussions',
                href: 'https://github.com/halo-dev/upage/discussions',
              },
            ],
          },
          {
            title: '更多',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/halo-dev/upage',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} 凌霞软件. Built with Docusaurus.`,
      },
      prism: {
        theme: require('prism-react-renderer').themes.github,
        darkTheme: require('prism-react-renderer').themes.dracula,
        additionalLanguages: ['bash']
      },
      colorMode: {
        defaultMode: 'light',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
    }),
};

module.exports = config;
