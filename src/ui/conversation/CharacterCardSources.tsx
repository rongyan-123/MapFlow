import { Button } from '../Button';
import { Icon } from '../Icon';

const communities=[
  {name:'类脑 · 中文酒馆社区',href:'https://discord.gg/odysseia'},
  {name:'废墟之下的藏书室',href:'https://discord.gg/UZ8JcvFFks'},
  {name:'Chub',href:'https://chub.ai/'},
  {name:'AI Character Cards',href:'https://aicharactercards.com/'},
];

export function CharacterCardSources({onBrowseOfficial,busy=false}:{onBrowseOfficial?:()=>void;busy?:boolean}){
  return <aside className="mf-character-sources" aria-label="角色卡资源">
    {onBrowseOfficial&&<div className="mf-stack"><h3>官方角色卡</h3><Button disabled={busy} onClick={onBrowseOfficial}>浏览官方角色卡</Button></div>}
    <nav aria-label="角色卡社区"><h3>点击此处浏览角色卡社区</h3><div className="mf-character-community-links">
      {communities.map(community=><a key={community.href} href={community.href} target="_blank" rel="noopener noreferrer"><span>{community.name}</span><Icon name="arrow" /></a>)}
    </div></nav>
    <p className="mf-muted mf-small">从社区下载 PNG 或 JSON 角色卡后，使用“导入角色卡”添加到你的角色库。</p>
  </aside>;
}
