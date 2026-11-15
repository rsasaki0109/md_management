import {createFromTemplate,findTemplates} from './templates.js';
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
const button=(text,fn,cls='')=>{const node=el('button',cls,text);node.type='button';node.onclick=fn;return node;};
export function showTemplatePicker({dialog,pages,parentId=null,onCreate}){
 let selected='blank';const date=new Date();dialog.replaceChildren();dialog.setAttribute('aria-labelledby','template-title');
 const heading=el('div','template-heading'),headingText=el('div');const title=el('h2','','新しいページ');title.id='template-title';headingText.append(title,el('p','','白紙から、またはテンプレートから。'));heading.append(headingText,button('閉じる',()=>dialog.close(),'template-close'));
 const layout=el('div','template-layout'),library=el('div','template-library'),search=el('input','template-search');search.type='search';search.placeholder='テンプレートを検索…';search.setAttribute('aria-label','テンプレートを検索');const list=el('div','template-list');library.append(search,list);
 const preview=el('div','template-preview');preview.setAttribute('aria-label','テンプレートのプレビュー');layout.append(library,preview);
 const footer=el('div','template-footer'),fields=el('div','template-fields');const nameLabel=el('label','','ページ名'),name=el('input');name.id='template-page-name';nameLabel.htmlFor=name.id;name.maxLength=300;nameLabel.append(name);
 const destinationLabel=el('label','','作成先'),destination=el('select');destination.id='template-destination';destinationLabel.htmlFor=destination.id;const root=el('option','','ワークスペース直下');root.value='';destination.append(root);
 const byId=new Map(pages.map(p=>[p.id,p]));for(const p of pages){const path=[p.title];let parent=byId.get(p.parentId),seen=new Set([p.id]);while(parent&&!seen.has(parent.id)){seen.add(parent.id);path.unshift(parent.title);parent=byId.get(parent.parentId);}const option=el('option','',p.icon+' '+path.join(' / '));option.value=p.id;destination.append(option);}destination.value=byId.has(parentId)?parentId:'';destinationLabel.append(destination);fields.append(nameLabel,destinationLabel);
 const error=el('p','template-error');error.setAttribute('role','alert');
 const submit=button('ページを作成',()=>{try{const page=createFromTemplate(selected,{parentId:destination.value||null,date,title:name.value});onCreate(page);dialog.close();}catch(e){error.textContent=e.message;}},'primary template-submit');footer.append(fields,error,submit);dialog.append(heading,layout,footer);
 function choose(id){selected=id;error.textContent='';const p=createFromTemplate(id,{date});name.value=p.title;drawList();preview.replaceChildren();preview.append(el('span','template-preview-label','PREVIEW'),el('div','template-preview-icon',p.icon),el('h3','',p.title));
  if(id==='blank')preview.append(el('p','template-blank','まだ何もない、このページから。'));
  else for(const b of p.blocks){const node=el(['h1','h2'].includes(b.type)?'h4':'p','template-block template-block-'+b.type,({bullet:'•  ',todo:'☐  ',quote:'❝  '}[b.type]||'')+(b.text||'…'));preview.append(node);}
  if(p.database){const board=el('div','template-mini-board');for(const label of ['未着手','進行中','完了']){const column=el('div');column.append(el('strong','',label));if(label==='未着手')for(const row of p.database.rows)column.append(el('p','',row.title));board.append(column);}preview.append(board);}
  preview.scrollTop=0;
 }
 function drawList(){list.replaceChildren();const found=findTemplates(search.value);if(!found.length)list.append(el('p','template-no-results','一致するテンプレートはありません'));for(const t of found){const card=button('',()=>choose(t.id),'template-card'+(selected===t.id?' selected':''));card.setAttribute('aria-pressed',String(selected===t.id));card.append(el('span','template-card-icon',t.icon));const info=el('span');info.append(el('strong','',t.name),el('small','',t.description));card.append(info);list.append(card);}}
 search.oninput=drawList;name.oninput=()=>{error.textContent='';};dialog.onkeydown=e=>{if(!e.isComposing&&(e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();submit.click();}};
 choose(selected);dialog.showModal();search.focus();
}
