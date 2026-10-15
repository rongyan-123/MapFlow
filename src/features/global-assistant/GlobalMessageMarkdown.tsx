import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type {Navigate} from '../../app/useLocation';

const sitePages=new Set(['/assistant','/library','/maps','/learning','/tavern','/wallet','/models','/settings']);
export default function GlobalMessageMarkdown({markdown,navigate}:{markdown:string;navigate:Navigate}){
  return <div className="mf-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{img:()=>null,a:({href,children})=>{
    if(typeof href!=='string')return <span>{children}</span>;
    if(href.startsWith('/')&&!href.startsWith('//')){
      const target=new URL(href,window.location.origin);
      if(target.origin===window.location.origin&&sitePages.has(target.pathname))return <a href={href} onClick={event=>{if(!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey&&event.button===0){event.preventDefault();navigate(href);}}}>{children}</a>;
    }
    return /^(https?:|mailto:)/i.test(href)?<a href={href} target="_blank" rel="noopener noreferrer">{children}</a>:<span>{children}</span>;
  }}}>{markdown}</ReactMarkdown></div>;
}
