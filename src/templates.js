import {page,block} from './model.js';
import {createDatabase,task} from './database.js';
export const templates=Object.freeze([
 {id:'blank',icon:'📄',name:'白紙のページ',category:'シンプル',description:'まっさらなページで、自由に書きはじめる。'},
 {id:'meeting',icon:'📝',name:'議事録',category:'仕事',description:'アジェンダ、決定事項、次のアクションをひとつに。'},
 {id:'daily',icon:'☀️',name:'日報',category:'毎日のこと',description:'今日やることと、一日の振り返りを残す。'},
 {id:'reading',icon:'📚',name:'読書メモ',category:'学び',description:'印象に残った言葉と、自分の考えを集める。'},
 {id:'project',icon:'🗂️',name:'プロジェクト計画',category:'仕事',description:'目的とマイルストーンを整理し、ボードでタスクを進める。'}
].map(Object.freeze));
function localDate(date){
 if(!(date instanceof Date)||Number.isNaN(+date))throw Error('日付が正しくありません');
 return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
}
export function createFromTemplate(id,{parentId=null,date=new Date(),title}={}){
 const template=templates.find(t=>t.id===id);if(!template)throw Error('テンプレートが見つかりません');
 const day=localDate(date),p=page(title?.trim()||(id==='blank'?'無題':template.name+(['meeting','daily'].includes(id)?' '+day:'')),parentId);p.icon=template.icon;
 const b=(type,text)=>block(type,text);
 if(id==='meeting')p.blocks=[b('text','日時: '+day),b('text','参加者: '),b('h2','この会議の目的'),b('text',''),b('h2','アジェンダ'),b('bullet','話し合いたいこと'),b('h2','メモ'),b('text',''),b('h2','決定事項'),b('bullet','決まったこと'),b('h2','次のアクション'),b('todo','担当者と期限を決める')];
 if(id==='daily')p.blocks=[b('text',day+' の記録'),b('h2','今日のフォーカス'),b('text','今日いちばん大切にしたいこと'),b('h2','やること'),b('todo','今日の最初の一歩'),b('h2','できたこと'),b('bullet',''),b('h2','気づき・学び'),b('text',''),b('h2','明日に向けて'),b('text','')];
 if(id==='reading')p.blocks=[b('text','書名: '),b('text','著者: '),b('text','読了日: '),b('h2','この本を選んだ理由'),b('text',''),b('h2','要点'),b('bullet',''),b('h2','心に残った言葉'),b('quote','引用したい言葉とページ番号'),b('h2','自分の考え'),b('text',''),b('h2','試してみたいこと'),b('todo','学びをひとつ実践する')];
 if(id==='project'){
  p.blocks=[b('h2','何を実現したいか'),b('text','プロジェクトの目的と、解決したい課題'),b('h2','成功の目安'),b('bullet','完了したと判断できる具体的な条件'),b('h2','スコープ'),b('text','取り組む範囲と、今回は扱わないこと'),b('h2','マイルストーン'),b('bullet','計画 → 実装 → 振り返り'),b('h2','参考資料'),b('text','関連するメモや資料へのページリンクを集めましょう。')];
  p.database=createDatabase();p.database.view='board';p.database.rows=['ゴールと成功条件を決める','作業を洗い出す','最初の成果を振り返る'].map(title=>({...task(),title}));
 }
 return p;
}
export function findTemplates(query=''){
 const q=query.trim().toLocaleLowerCase();return templates.filter(t=>[t.name,t.category,t.description].join(' ').toLocaleLowerCase().includes(q));
}
