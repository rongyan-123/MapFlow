import {learningGuide} from "../../domains/support/agentGuide";
import {useState} from 'react';
import type {Navigate} from '../../app/useLocation';
import {Dialog} from '../Dialog';
import {Button} from '../Button';
const steps=learningGuide;
export default function LearningGuideDialog({onClose,navigate}:{onClose:()=>void;navigate:Navigate}){const [index,setIndex]=useState(0);const step=steps[index];return <Dialog title="开始使用 MapFlow" onClose={onClose}><div className="mf-stack"><p className="mf-eyebrow">{index+1} / {steps.length}</p><h2>{step.title}</h2><p>{step.description}</p><Button variant="primary" onClick={()=>{onClose();navigate(step.path);}}>{step.action}</Button><div className="mf-row mf-row--between"><Button disabled={!index} onClick={()=>setIndex(index-1)}>上一步</Button>{index<steps.length-1?<Button onClick={()=>setIndex(index+1)}>下一步</Button>:<Button onClick={onClose}>完成引导</Button>}</div></div></Dialog>;}
