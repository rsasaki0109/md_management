import {test} from 'node:test';
import assert from 'node:assert/strict';
import {localToday,monthDays,monthCells,shiftMonth,tasksForDate,rescheduleTask,filterDeadlines} from '../src/calendar.js';
import {createDatabase,task,visibleTasks} from '../src/database.js';
import {initial,validateBackup,toMarkdown,fromMarkdown} from '../src/model.js';
import {History} from '../src/history.js';

test('month grids start Monday and cover each date exactly once with whole weeks',()=>{
 const cells=monthCells(2026,11);assert.equal(cells.length,42);assert.ok(cells.slice(0,6).every(cell=>cell===null));assert.equal(cells[6],'2026-11-01');assert.equal(cells[35],'2026-11-30');assert.ok(cells.slice(36).every(cell=>cell===null));
 const feb=monthCells(2021,2);assert.equal(feb.length,28);assert.equal(feb[0],'2021-02-01');assert.equal(feb.at(-1),'2021-02-28');
 for(const year of [1,99,1900,2000,2024,2026,9999])for(let month=1;month<=12;month++){const grid=monthCells(year,month),dates=grid.filter(Boolean);assert.equal(grid.length%7,0);assert.ok(grid.length<=42);assert.equal(dates.length,monthDays(year,month));assert.equal(new Set(dates).size,dates.length);}
});

test('leap years, century exceptions and four-digit small years are handled correctly',()=>{
 assert.equal(monthDays(1900,2),28);assert.equal(monthDays(2000,2),29);assert.equal(monthDays(2024,2),29);assert.equal(monthDays(2025,2),28);assert.ok(monthCells(4,2).includes('0004-02-29'));
 for(const [year,month] of [[0,1],[10000,1],[2026,0],[2026,13],[2026.5,1]])assert.throws(()=>monthCells(year,month));
});

test('month navigation crosses years and stays within supported date bounds',()=>{
 assert.deepEqual(shiftMonth(2026,12,1),{year:2027,month:1});assert.deepEqual(shiftMonth(2026,1,-1),{year:2025,month:12});assert.deepEqual(shiftMonth(2026,2,12),{year:2027,month:2});assert.equal(shiftMonth(1,1,-1),null);assert.equal(shiftMonth(9999,12,1),null);assert.equal(shiftMonth(2026,1,.5),null);
});

test('today uses local date components rather than converting to UTC',()=>{
 const now=new Date(2026,10,15,23,59);assert.equal(localToday(now),'2026-11-15');assert.throws(()=>localToday(new Date('invalid')));
});

test('calendar groups the shared filtered rows and keeps undated tasks separate',()=>{
 const db=createDatabase(),a={...task(),title:'Write',due:'2026-11-15'},b={...task('done'),title:'Review',due:'2026-11-15'},c={...task(),title:'Later',due:'2026-12-01'},d=task();db.rows=[a,b,c,d];
 assert.deepEqual(tasksForDate(db.rows,'2026-11-15'),[a,b]);assert.deepEqual(tasksForDate(db.rows,''),[d]);assert.deepEqual(tasksForDate(visibleTasks(db,{status:'todo'}),'2026-11-15'),[a]);assert.deepEqual(tasksForDate(visibleTasks(db,{query:'Review'}),'2026-11-15'),[b]);assert.deepEqual(db.rows,[a,b,c,d]);
});

test('rescheduling changes only the due date and rejects invalid or unchanged edits',()=>{
 const db=createDatabase(),row={...task('doing'),title:'Task',priority:'high',due:'2026-11-15'};db.rows=[row];const original={...row};assert.equal(rescheduleTask(db,row.id,'2026-12-01'),true);assert.equal(db.rows[0],row);assert.deepEqual(row,{...original,due:'2026-12-01'});
 for(const date of ['2026-02-30','0000-01-01','not a date','2026-12-01']){assert.equal(rescheduleTask(db,row.id,date),false);assert.equal(row.due,'2026-12-01');}assert.equal(rescheduleTask(db,'missing',''),false);assert.equal(rescheduleTask(db,row.id,''),true);assert.deepEqual(tasksForDate(db.rows,''),[row]);
});

test('calendar view and date edits survive history, JSON backup and Markdown value roundtrip',()=>{
 const state=initial(),p=state.pages[0];p.database=createDatabase();p.database.rows=[{...task(),title:'Task',due:'2026-11-15'}];const h=new History(state);p.database.view='calendar';h.record(state);rescheduleTask(p.database,p.database.rows[0].id,'2026-12-01');h.record(state);
 assert.equal(h.step(-1).value.pages[0].database.rows[0].due,'2026-11-15');assert.equal(h.step(-1).value.pages[0].database.view,'table');assert.equal(h.step(1).value.pages[0].database.view,'calendar');
 assert.equal(validateBackup(JSON.parse(JSON.stringify(state))).pages[0].database.view,'calendar');assert.equal(fromMarkdown(toMarkdown(p)).database.rows[0].due,'2026-12-01');assert.doesNotThrow(()=>validateBackup(initial()));
});

test('deadline filters distinguish today, unfinished overdue, next seven days and undated',()=>{const rows=[{id:'y',due:'2026-11-16',status:'todo'},{id:'done',due:'2026-11-16',status:'done'},{id:'today',due:'2026-11-17',status:'done'},{id:'last',due:'2026-11-23',status:'doing'},{id:'later',due:'2026-11-24',status:'todo'},{id:'none',due:'',status:'todo'}];const ids=filter=>filterDeadlines(rows,filter,'2026-11-17').map(r=>r.id);assert.deepEqual(ids('today'),['today']);assert.deepEqual(ids('overdue'),['y']);assert.deepEqual(ids('next7'),['today','last']);assert.deepEqual(ids('undated'),['none']);assert.deepEqual(ids('all'),rows.map(r=>r.id));});
test('seven-day window crosses month, leap-day and year boundaries',()=>{for(const [today,last,outside] of [['2024-02-27','2024-03-04','2024-03-05'],['2026-12-29','2027-01-04','2027-01-05'],['9999-12-29','9999-12-31','']]){const rows=[{due:last,status:'todo'},{due:outside,status:'todo'}];assert.deepEqual(filterDeadlines(rows,'next7',today),[rows[0]]);}});
test('deadline filtering preserves row identity and input ordering without mutating data',()=>{const rows=[{due:'2026-11-17',status:'todo'},{due:'',status:'doing'}],before=structuredClone(rows);assert.equal(filterDeadlines(rows,'today','2026-11-17')[0],rows[0]);assert.deepEqual(rows,before);assert.notEqual(filterDeadlines(rows),rows);assert.throws(()=>filterDeadlines(rows,'today','invalid'));});
