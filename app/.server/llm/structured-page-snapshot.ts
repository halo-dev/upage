import { type CallSettings, generateText, type LanguageModel } from 'ai';
import type { PageData } from '~/types/pages';

export async function structuredPageSnapshot({
  pages,
  model,
  abortSignal,
}: {
  pages: PageData[];
  model: LanguageModel;
} & CallSettings) {
  return await generateText({
    system: `
你是一名严谨的前端页面审阅与摘要助手。你将收到多个页面的 Body 片段，可能包含 script 与 style。你的任务是：
1) 从这些页面内容中提取结构化信息；
2) 以严格的 XML 风格（非 JSON、非 Markdown、无额外说明文本）输出一个“现有页面摘要快照”；
3) 仅基于给定内容进行总结，不得臆测未出现的信息；不回显原始全文；
4) 若某项信息无法确定，请输出空元素，不要编造。

输出必须严格遵循以下 XML 模板（标签名与层级必须一致；可重复的节点可按需要重复；所有一级大纲必须保留）：
<snapshot>
  <generated_at></generated_at>
  <pages_count></pages_count>
  <global_overview>
    <shared_components></shared_components>
    <shared_styles></shared_styles>
    <shared_scripts></shared_scripts>
    <navigation_overview></navigation_overview>
    <notable_assets></notable_assets>
  </global_overview>
  <pages>
    <page>
      <name></name>
      <summary></summary>
      <layout>
        <structure></structure>
        <sections></sections>
        <components>
          <component>
            <name></name>
            <role></role>
            <props></props>
            <events></events>
          </component>
        </components>
      </layout>
      <content>
        <headings>
          <h1></h1>
          <h2_list>
            <h2></h2>
          </h2_list>
        </headings>
        <text_stats>
          <char_count></char_count>
          <word_count></word_count>
          <language_guess></language_guess>
        </text_stats>
        <links>
          <a href="" text=""></a>
        </links>
        <forms>
          <form id="" action="" method="">
            <fields>
              <field name="" type="" required=""></field>
            </fields>
            <validation></validation>
            <submit_targets></submit_targets>
          </form>
        </forms>
        <media>
          <img src="" alt=""></img>
          <video src="" title=""></video>
        </media>
        <tables>
          <table summary=""></table>
        </tables>
      </content>
      <interactions>
        <events>
          <event type="" target="" handler_summary=""></event>
        </events>
        <state>
          <variables>
            <variable name="" initial=""></variable>
          </variables>
          <persistence></persistence>
        </state>
      </interactions>
      <data_flow>
        <inputs></inputs>
        <outputs></outputs>
        <api_calls>
          <api url="" method="" when=""></api>
        </api_calls>
      </data_flow>
      <style_summary>
        <inline_styles></inline_styles>
        <classes></classes>
        <themes></themes>
      </style_summary>
      <script_summary>
        <libraries></libraries>
        <modules></modules>
        <security_notes></security_notes>
      </script_summary>
      <seo>
        <title></title>
        <meta_description></meta_description>
        <canonical></canonical>
        <h_tags></h_tags>
      </seo>
      <i18n>
        <locales_detected></locales_detected>
        <hardcoded_texts></hardcoded_texts>
      </i18n>
      <issues>
        <problem severity="">
          <desc></desc>
          <evidence></evidence>
          <suggestion></suggestion>
        </problem>
      </issues>
      <complexity score=""></complexity>
      <confidence score=""></confidence>
    </page>
  </pages>
</snapshot>

严格输出规则：
- 仅输出上述 XML，不要输出任何解释性文字、代码块符号或 Markdown；
- 标签名、层级和顺序必须与模板保持一致；
- 允许重复的子节点按需要重复；
- 内容以中文撰写；
- 不得包含未在输入中出现的臆测信息；
- 无法确定的信息保留为空元素。
    `,
    prompt: `
以下是页面内容：
---
<pages>
${pages.map((page) => `<page_name>${page.name}</page_name><page_content>${page.content}</page_content>`).join('\n --- \n')}
</pages>
---
`,
    model,
    abortSignal,
  });
}
