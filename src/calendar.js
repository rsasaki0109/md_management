import {validDate} from './database.js';
export function localToday(now=new Date()){
 if(!(now instanceof Date)||Number.isNaN(+now))throw Error('日付が正しくありません');
 return [String(now.getFullYear()).padStart(4,'0'),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
}
export function monthDays(year,month){
 if(!Number.isInteger(year)||year<1||year>9999||!Number.isInteger(month)||month<1||month>12)throw Error('年月が正しくありません');
 return [31,(year%4===0&&(year%100!==0||year%400===0))?29:28,31,30,31,30,31,31,30,31,30,31][month-1];
}
export function monthCells(year,month){
 const days=monthDays(year,month),first=new Date(0);first.setUTCFullYear(year,month-1,1);first.setUTCHours(0,0,0,0);
 const offset=(first.getUTCDay()+6)%7,prefix=String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0')+'-';
 return Array.from({length:Math.ceil((offset+days)/7)*7},(_,i)=>i<offset||i>=offset+days?null:prefix+String(i-offset+1).padStart(2,'0'));
}
export function shiftMonth(year,month,delta){
 monthDays(year,month);if(!Number.isInteger(delta))return null;
 const index=(year-1)*12+month-1+delta;if(index<0||index>=9999*12)return null;
 return {year:Math.floor(index/12)+1,month:index%12+1};
}
export function tasksForDate(rows,date){return rows.filter(row=>row.due===date);}
export function rescheduleTask(db,id,date){
 const row=db.rows.find(row=>row.id===id);if(!row||!validDate(date)||row.due===date)return false;row.due=date;return true;
}

export function filterDeadlines(rows,filter='all',today=localToday()){
 if(filter==='all')return rows.slice();
 if(!validDate(today)||!today)throw Error('基準日が正しくありません');
 const end=new Date(today+'T00:00:00Z');end.setUTCDate(end.getUTCDate()+6);
 const last=end.getUTCFullYear()>9999?'9999-12-31':end.toISOString().slice(0,10);
 return rows.filter(row=>{
  if(filter==='undated')return row.due==='';
  if(filter==='today')return row.due===today;
  if(filter==='overdue')return !!row.due&&row.due<today&&row.status!=='done';
  if(filter==='next7')return !!row.due&&row.due>=today&&row.due<=last;
  return false;
 });
}
