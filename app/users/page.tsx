import {redirect} from 'next/navigation';
export default function UsersPage({searchParams}:{searchParams:{tab?:string}}){if(searchParams.tab==='settings')redirect('/app-access?tab=user-settings');redirect('/apps?tab=central&section=users'+(searchParams.tab==='roles'?'&userTab=roles':''));}
