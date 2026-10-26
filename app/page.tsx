import {redirect} from 'next/navigation';
export default function Home({searchParams}:{searchParams:Record<string,string|string[]|undefined>}){
 // Keep bookmarked table-creation and restore links working.
 if(searchParams.new==='1'||searchParams.restored==='1'){const query=new URLSearchParams();for(const [key,value] of Object.entries(searchParams))if(typeof value==='string')query.set(key,value);redirect('/data?'+query.toString());}
 redirect('/apps');
}
