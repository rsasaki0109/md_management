const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const button=(text,click,cls='')=>{const n=el('button',cls,text);n.type='button';n.onclick=click;return n;};
export function issueDraft(candidate){
 const draft=candidate.draft,details=el('details','project-issue-draft');details.append(el('summary','','Issue 本文の修正案を確認'));
 details.append(el('p','',draft.sourceUpdatedAt?'取得した本文の更新日時: '+new Date(draft.sourceUpdatedAt).toLocaleString('ja-JP'):'取得した Issue 本文をもとにした修正案です'));
 details.append(el('pre','project-draft-diff','− '+draft.before+'\n＋ '+draft.after),el('p','','末尾の進捗欄に台帳・受理済み報告へのリンクと残りの募集件数を追加します。'));
 const text=el('textarea','project-draft-text');text.readOnly=true;text.rows=9;text.value=draft.updated;text.setAttribute('aria-label',candidate.source+' の修正文');details.append(text);
 const status=el('p','project-draft-status');status.setAttribute('role','status');
 const copy=button('修正した本文をコピー',async()=>{try{if(!navigator.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(text.value);status.textContent='コピーしました。GitHub の編集画面で最新の本文と照合してから貼り付けてください。';}catch{text.focus();text.select();status.textContent='コピーできませんでした。選択した本文を手動でコピーしてください。';}},'project-copy-draft');details.append(copy,status);return details;
}
export function taskContextDetails(context){
 const details=el('details','task-work-details');details.append(el('summary','','作業の根拠・修正案'));
 details.append(el('p','','保存した作業: '+context.action),el('p','',context.reason),el('p','','完了の目安: '+context.done));
 for(const source of [{label:context.source,url:context.url},...context.evidence]){if(!source.url)continue;const link=el('a','project-evidence',source.label+' ↗');link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';details.append(link);}
 if(context.draft)details.append(issueDraft(context));return details;
}
