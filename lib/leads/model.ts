export type WebsiteStatus = "unknown" | "present" | "absent";
export type Lead = {
  id: string;
  name: string;
  address: string;
  email: string;
  phone: string;
  website: string;
  websiteStatus: WebsiteStatus;
  contacted: boolean;
  notes: string;
  source: "manual" | "csv" | "geoapify";
  sourceId: string;
  createdAt: string;
  updatedAt: string;
  performance?: { mobile: number | null; desktop: number | null; checkedAt: string };
};
export type LeadInput = Pick<Lead,"name"|"address"|"email"|"phone"|"website"|"websiteStatus"|"contacted"|"notes"|"source"|"sourceId">;
export const emptyLead: LeadInput = {name:"",address:"",email:"",phone:"",website:"",websiteStatus:"unknown",contacted:false,notes:"",source:"manual",sourceId:""};
export function normaliseWebsite(value:string):string {
  if (!value.trim()) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(value.trim()) && !value.trim().toLowerCase().startsWith("http://") && !value.trim().toLowerCase().startsWith("https://")) throw new Error("Use an http or https website address.");
  const url = new URL(/^https?:\/\//i.test(value.trim())?value.trim():`https://${value.trim()}`);
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password) throw new Error("Use a valid http or https website address.");
  return url.toString();
}
export function validateLead(input: unknown): LeadInput {
  if (!input || typeof input !== "object") throw new Error("Invalid business record.");
  const o=input as Record<string,unknown>;
  const str=(key:string,max:number)=>{const v=o[key]??"";if(typeof v!=="string"||v.length>max)throw new Error(`${key} must be text, up to ${max} characters.`);return v.trim()};
  const name=str('name',200);if(!name)throw new Error("Business name is required.");
  const email=str('email',254);if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error("Enter a valid email address.");
  const website=normaliseWebsite(str('website',2000));
  const status=o.websiteStatus??"unknown";
  if(!['present','absent','unknown'].includes(String(status)))throw new Error("Invalid website status.");
  if(status==='present'&&!website)throw new Error("Add a website URL or choose Website unknown.");
  if(o.contacted!==undefined&&typeof o.contacted!=="boolean")throw new Error("Invalid contact status.");
  const source=o.source??"manual";if(!['manual','csv','geoapify'].includes(String(source)))throw new Error("Invalid source.");
  return {name,email,website,websiteStatus:website?'present':status as WebsiteStatus,address:str('address',500),phone:str('phone',80),notes:str('notes',5000),source:source as LeadInput['source'],sourceId:str('sourceId',500),contacted:o.contacted===true};
}
export function identity(lead: LeadInput): string {
  // Name + location avoids merging branches that share a website.
  return `${lead.name.toLowerCase().replace(/\s+/g,' ')}|${lead.address.toLowerCase().replace(/\s+/g,' ')}|${lead.address?'':lead.website||lead.email.toLowerCase()}`;
}
