"use client";
import {Fragment} from 'react';
import {WORKFLOW_EVENTS,WORKFLOW_STEPS,type Workflow,type WorkflowStep} from '@/lib/workflow-config';
import Icon,{type IconName} from './Icon';

export type WorkflowNode='trigger'|'condition'|number;
export const WORKFLOW_EVENT_ICONS:Record<Workflow['event'],IconName>={manual:'play',create:'plus',update:'edit',delete:'trash',schedule:'clock'};
const STEP_ICONS:Record<WorkflowStep['kind'],IconName>={action:'formula',webhook:'external',pdf:'file'};
export default function WorkflowCanvas({workflow,selected,onSelect,onAdd,actions,templates}:{
 workflow:Workflow;selected:WorkflowNode;onSelect:(node:WorkflowNode)=>void;onAdd:(kind:WorkflowStep['kind'])=>void;
 actions:{name:string;label:string}[];templates:{name:string;label:string}[];
}){
 const nodes:{id:WorkflowNode;label:string;detail:string;icon:IconName;kind:string}[]=[
  {id:'trigger',label:'เมื่อไหร่',detail:WORKFLOW_EVENTS[workflow.event],icon:WORKFLOW_EVENT_ICONS[workflow.event],kind:'trigger'},
  {id:'condition',label:'ถ้า · เงื่อนไข',detail:workflow.condition_expr||'ยังไม่ได้ใส่เงื่อนไข',icon:'filter',kind:'condition'},
  ...workflow.steps.map((step,index)=>({id:index,label:WORKFLOW_STEPS[step.kind],detail:step.kind==='action'?actions.find(a=>a.name===step.action_name)?.label||'เลือก Action':step.kind==='pdf'?templates.find(t=>t.name===step.template_name)?.label||'เลือกแม่แบบ PDF':step.url||'กำหนด URL ปลายทาง',icon:STEP_ICONS[step.kind],kind:step.kind}))
 ];
 return <section className="workflow-canvas" aria-label="แผนผัง Automation">
  <header className="workflow-canvas-header"><div><strong>ลำดับการทำงาน</strong><small>เลือกโหนดเพื่อตั้งค่า</small></div><span className="badge">{workflow.steps.length}/10 ขั้นตอน</span></header>
  <div className="workflow-canvas-viewport" role="region" aria-label="โหนดการทำงาน" tabIndex={0}>
   <div className="workflow-flow-track">{nodes.map((node,index)=><Fragment key={String(node.id)}>{index>0&&<span className="workflow-flow-edge" aria-hidden="true"><Icon name="chevron" width="14" height="14"/></span>}<button type="button" className={'workflow-flow-node kind-'+node.kind} aria-pressed={selected===node.id} aria-label={typeof node.id==='number'?'ตั้งค่าขั้นตอน '+(node.id+1):node.id==='trigger'?'ตั้งค่าเหตุการณ์':'ตั้งค่าเงื่อนไข'} title={node.detail} onClick={()=>onSelect(node.id)}><span className="workflow-node-icon"><Icon name={node.icon} width="24" height="24"/></span><strong>{typeof node.id==='number'?(node.id+1)+'. ':''}{node.label}</strong><small>{node.detail}</small><span className="workflow-node-port" aria-hidden="true"/></button></Fragment>)}</div>
  </div>
  <div className="workflow-canvas-caption"><Icon name="chevron" width="14" height="14"/><span>เหตุการณ์ → ผ่านเงื่อนไข → ทำแต่ละขั้นตอนตามลำดับ</span></div>
  <footer className="workflow-canvas-footer"><span className="field-label">เพิ่มขั้นตอน</span><div className="workflow-add-steps">{Object.entries(WORKFLOW_STEPS).map(([kind,label])=><button type="button" disabled={workflow.steps.length>=10} key={kind} onClick={()=>onAdd(kind as WorkflowStep['kind'])}><Icon name={STEP_ICONS[kind as WorkflowStep['kind']]} width="16" height="16"/>{label}<Icon name="plus" width="14" height="14"/></button>)}</div></footer>
 </section>;
}
