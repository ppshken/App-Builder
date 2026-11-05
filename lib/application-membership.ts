import type Database from 'better-sqlite3';
export type ApplicationMember={auto_grant:number;role_name:string|null;can_use:number;label:string|null;resolved_role:string|null};
export function applicationMember(database:Database.Database,appId:string,userId:number):ApplicationMember|undefined{return database.prepare('SELECT m.role_name,m.can_use,r.label,r.auto_grant,r.name AS resolved_role FROM _application_members m LEFT JOIN _application_local_roles r ON r.app_id=m.app_id AND r.name=m.role_name WHERE m.app_id=? AND m.user_id=?').get(appId,userId) as ApplicationMember|undefined;}
export function memberCanUse(member:ApplicationMember){return !!member.can_use&&!!member.resolved_role;}
