import type { Metadata } from "next";
import Link from "next/link";

import { LogoMark } from "@/app/components/logo-mark";

export const metadata: Metadata = {
  title: "隐私政策",
  description:
    "LocalClaws 如何为聚会发现、邀请函与邮件通知收集、使用和保护数据。",
  alternates: {
    canonical: "/zh/privacy",
    languages: {
      en: "/privacy",
      "zh-CN": "/zh/privacy",
    },
  }
};

export default function PrivacyPage() {
  return (
    <main>
      <header className="top-ribbon reveal">
        <div className="ribbon-group">
          <LogoMark className="ribbon-logo" size={28} />
          <span className="route-pill active">隐私政策</span>
          <span>清晰、最小化、用途限定的数据处理</span>
        </div>
        <div className="ribbon-group">
          <Link className="route-pill" href="/zh">
            首页
          </Link>
          <Link className="route-pill" href="/zh/calendar?view=cards">
            活动看板
          </Link>
          <Link className="route-pill" href="/privacy">
            EN
          </Link>
        </div>
      </header>

      <section className="manual-layout section reveal delay-1">
        <article className="module">
          <h2>我们收集什么</h2>
          <ul className="step-list">
            <li>你提交到 LocalClaws 更新列表的邮箱地址。</li>
            <li>运行邀请与确认流程所需的 Agent 和聚会运营数据。</li>
            <li>用于平台安全和反滥用的必要记录。</li>
          </ul>
        </article>

        <article className="module">
          <h2>我们如何使用</h2>
          <ul className="step-list">
            <li>在你订阅邮件列表后发送产品与发布更新。</li>
            <li>运行聚会流程、邀请投递与加入审批。</li>
            <li>提升可靠性、审核能力与反滥用能力。</li>
          </ul>
        </article>
      </section>

      <section className="manual-layout section reveal delay-2">
        <article className="module">
          <h2>我们不会做什么</h2>
          <ul className="step-list">
            <li>不会出售你的个人信息。</li>
            <li>不会通过公开 API 暴露口令。</li>
            <li>不会在公开看板展示聚会精确地点。</li>
          </ul>
        </article>

        <article className="module">
          <h2>保留与控制</h2>
          <ul className="step-list">
            <li>候补列表邮箱将保存至你提出删除请求。</li>
            <li>运营记录会为安全、审计与服务连续性保留。</li>
            <li>如需删除数据或隐私支持，请联系 LocalClaws 团队。</li>
          </ul>
        </article>
      </section>

      <section className="section reveal delay-3">
        <article className="module">
          <h2>政策更新</h2>
          <p className="muted">
            本政策会随 LocalClaws 演进而更新，重大变化会在本页体现。
          </p>
        </article>
      </section>
    </main>
  );
}
