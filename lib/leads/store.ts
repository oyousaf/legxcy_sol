import { kv } from '@vercel/kv';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { identity, type Lead, type LeadInput } from './model';
const KEY='outreach:leads:v2';
const local=()=>process.env.NODE_ENV==='development' && !process.env.VERCEL;
const file=()=>path.join(process.cwd(),'.data','outreach-leads.json');
let queue:Promise<unknown>=Promise.resolve();
function serial<T>(action:()=>Promise<T>):Promise<T>{const work=queue.then(action,action);queue=work.catch(()=>{});return work}
async function readLocal():Promise<Record<string,Lead>>{try{return JSON.parse(await readFile(file(),'utf8'))}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {};throw e}}
async function writeLocal(data:Record<string,Lead>){await mkdir(path.dirname(file()),{recursive:true});const tmp=file()+'.tmp';await writeFile(tmp,JSON.stringify(data,null,2));await rename(tmp,file())}
export function storageMode(){return local()?'local':'cloud'}
export async function getLeads():Promise<Lead[]>{const data=local()?await serial(readLocal):await kv.hgetall<Record<string,Lead>>(KEY)||{};return Object.values(data).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))}
export async function addLeads(inputs:LeadInput[]){
  const now=new Date().toISOString();const records=inputs.map(input=>({...input,id:createHash('sha256').update(identity(input)).digest('hex').slice(0,32),createdAt:now,updatedAt:now}));
  if(local())return serial(async()=>{const all=await readLocal();let added=0;for(const r of records){if(!all[r.id]){all[r.id]=r;added++}}await writeLocal(all);return {added,skipped:records.length-added}});
  // Atomic insert-if-absent preserves saved notes and statuses on repeat imports.
  const batch=kv.pipeline();
  for(const r of records) batch.hsetnx(KEY,r.id,JSON.stringify(r));
  const results=await batch.exec<number[]>();
  const added=results.reduce((sum,value)=>sum+Number(value),0);
  return {added,skipped:records.length-added};
}
export async function updateLead(id:string,patch:Partial<Lead>):Promise<Lead>{
  const changes={...patch,updatedAt:new Date().toISOString()};
  if(local())return serial(async()=>{const all=await readLocal();if(!all[id])throw new Error('Business not found.');const record={...all[id],...changes,id};all[id]=record;await writeLocal(all);return record});
  const result=await kv.eval<string[], string | Lead | null>(`local raw=redis.call('HGET',KEYS[1],ARGV[1]); if not raw then return nil end; local lead=cjson.decode(raw); local patch=cjson.decode(ARGV[2]); for k,v in pairs(patch) do lead[k]=v end; local encoded=cjson.encode(lead); redis.call('HSET',KEYS[1],ARGV[1],encoded); return encoded`,[KEY],[id,JSON.stringify(changes)]);
  if(!result)throw new Error('Business not found.');return typeof result==='string'?JSON.parse(result):result;
}
