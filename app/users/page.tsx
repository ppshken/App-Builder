import {redirect} from 'next/navigation';
export default async function UsersPage({searchParams:pendingSearchParams}:{searchParams:Promise<{tab?:string}>}){const searchParams=await pendingSearchParams;if(searchParams.tab==='settings')redirect('/app-access?tab=user-settings');redirect('/apps?tab=central&section=users'+(searchParams.tab==='roles'?'&userTab=roles':''));}
