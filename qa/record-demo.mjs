// Record real Chromium UI states. No mock UI or illustration is used.
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=new URL('../artifacts/demo-frames/',import.meta.url).pathname;await mkdir(output,{recursive:true});
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1280,height:820},locale:'ja-JP'}),page=await context.newPage();let frame=0;
async function capture(count=1){for(let i=0;i<count;i++){await page.waitForTimeout(180);await page.screenshot({path:output+'frame-'+String(frame++).padStart(3,'0')+'.png'});}}
try{
 await page.goto(process.env.QA_URL||'http://127.0.0.1:3000');await page.locator('#page-title').waitFor();await capture(3);
 await page.locator('#new-page').click();await page.locator('.template-card').filter({hasText:'プロジェクト計画'}).click();await capture(4);
 await page.locator('#template-page-name').fill('週末につくる、小さなプロジェクト');await capture(2);await page.locator('.template-submit').click();await capture(4);
 await page.locator('.database').scrollIntoViewIfNeeded();await capture(3);await page.locator('.task-title').first().fill('アイデアを整理する');await capture(2);
 await page.locator('.task-drag-handle').first().dragTo(page.locator('.db-column').nth(1),{targetPosition:{x:40,y:55}});await capture(4);
 await page.getByRole('button',{name:'▤ テーブル',exact:true}).click();await capture(3);await page.locator('.task-due').first().fill(new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0')+'-20');await page.locator('.task-due').first().press('Tab');await capture(2);
 await page.getByRole('button',{name:'▦ カレンダー',exact:true}).click();await page.locator('.db-calendar').scrollIntoViewIfNeeded();await capture(4);
 await page.locator('#search-open').click();await page.locator('#search-input').fill('アイデアノート');await capture(3);await page.locator('.search-result').first().click();await capture(3);
 await page.locator('.block-edit').last().fill('[[');await capture(2);await page.locator('.link-choice').filter({hasText:'週末につくる'}).click();await capture(2);await page.locator('.page-link').filter({hasText:'週末につくる'}).click();await page.locator('.backlinks').scrollIntoViewIfNeeded();await capture(5);
 console.log('Recorded '+frame+' real UI frames in '+output);
}finally{await browser.close();}
