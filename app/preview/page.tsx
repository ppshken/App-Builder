import { redirect } from "next/navigation";
export default async function Page({searchParams:pendingSearchParams}:{searchParams:Promise<{view?:string}>}){const searchParams=await pendingSearchParams; redirect(searchParams.view ? `/views?view=${encodeURIComponent(searchParams.view)}` : "/views"); }
