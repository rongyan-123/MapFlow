import type { Navigate } from '../app/useLocation';
import type { IdentitySession } from '../domains/identity/types';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { BrandMark } from '../ui/BrandMark';
import { WelcomeArtwork } from '../ui/WelcomeArtwork';
import publicContent from '../content/publicContent.json';

export default function LandingPage({navigate,session,onHelp}:{navigate:Navigate;session:IdentitySession|null;onHelp:()=>void}) {
  return <div className="mf-landing"><header className="mf-landing-header"><a className="mf-brand" href="/"><span className="mf-brand-mark"><BrandMark /></span>MapFlow</a><nav><a className="mf-button mf-button--quiet" href="/explore">公共书库</a><a className="mf-button mf-button--quiet" href="/guides">使用教程</a><Button variant="primary" onClick={()=>navigate(session?'/assistant':'/login')}>{session?'进入工作空间':'登录'}</Button></nav></header>
    <main><section className="mf-landing-hero"><div><span className="mf-pill mf-pill--green"><Icon name="spark" /> 把学习连成一张地图</span><h1>{publicContent.site.headline}</h1><p>{publicContent.site.paragraphs[1]}</p><div className="mf-row mf-wrap"><Button variant="primary" onClick={()=>navigate(session?'/assistant':'/register')}>开始学习 <Icon name="right" /></Button><a className="mf-button" href="/explore">浏览公共地图</a></div><small className="mf-muted">已有账号？<button className="mf-text-action" onClick={()=>navigate('/login')}>继续你的学习</button></small></div>
    <div className="mf-landing-map" aria-label="学习路线示意"><div className="mf-landing-map-caption"><span className="mf-eyebrow">A CLEARER WAY TO LEARN</span><Icon name="map" /></div><WelcomeArtwork /><div className="mf-path-node mf-path-node--root"><Icon name="spark" /><span>我想学什么？</span></div><span className="mf-path-link" aria-hidden="true" /><div className="mf-path-columns"><div className="mf-path-node"><Icon name="book" />建立基础</div><div className="mf-path-node"><Icon name="code" />动手实践</div></div><span className="mf-path-link" aria-hidden="true" /><div className="mf-path-node"><Icon name="check" />看见每一步的进展</div><p>从兴趣，到能独立完成。</p></div></section>
    <section className="mf-landing-features"><div className="mf-section-title"><h2>学什么，怎么学，接着学。</h2></div><div className="mf-grid mf-grid--3"><article className="mf-card"><Icon name="chat" /><h3>从一个问题开始</h3><p>告诉助手你想学的方向，一起规划适合你的学习路线。</p></article><article className="mf-card"><Icon name="map" /><h3>知识，有迹可循</h3><p>地图串起概念和前置知识。每个节点都有下一步的线索。</p></article><article className="mf-card"><Icon name="learn" /><h3>边学，边理解</h3><p>结合地图聊天、记笔记、画图解释，让每一次理解都留下来。</p></article></div></section>
    <section className="mf-landing-cta"><h2>你想学的那件事，值得开始。</h2><Button variant="primary" onClick={()=>navigate(session?'/assistant':'/register')}>打开我的学习地图 <Icon name="right" /></Button></section></main>
    <footer className="mf-landing-footer"><span>MapFlow · 想学哪里，就走向哪里</span><a href="/guides">使用教程与 Agent 接入</a><button className="mf-text-action" onClick={onHelp}>帮助与反馈</button></footer>
  </div>;
}
