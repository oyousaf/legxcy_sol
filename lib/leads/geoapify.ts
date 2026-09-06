import {emptyLead,normaliseWebsite,type LeadInput} from './model';
type Feature={properties?:Record<string,unknown>};
export function geoapifyLeads(features:Feature[]):LeadInput[]{
  const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'?v as Record<string,unknown>:{};
  const str=(...v:unknown[])=>v.find(x=>typeof x==='string'&&x.trim()) as string||'';
  return features.flatMap(f=>{const p=f.properties||{};const raw=object(object(p.datasource).raw);const contact=object(p.contact);const name=str(p.name);if(!name)return [];
    let website='';try{website=normaliseWebsite(str(p.website,contact.website,raw.website,raw['contact:website']))}catch{}
    const email=str(contact.email,raw.email,raw['contact:email']);
    return [{...emptyLead,name,address:str(p.formatted,p.address_line2),email:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:'',phone:str(contact.phone,raw.phone,raw['contact:phone']),website,websiteStatus:website?'present':'unknown',source:'geoapify',sourceId:str(p.place_id)} as LeadInput];
  });
}
