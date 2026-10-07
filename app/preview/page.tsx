import { redirect } from "next/navigation";
export default function Page({searchParams}:{searchParams:{view?:string}}){ redirect(searchParams.view ? `/views?view=${encodeURIComponent(searchParams.view)}` : "/views"); }
