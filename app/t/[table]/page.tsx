"use client";
import { useParams, useSearchParams } from "next/navigation";
import RuntimeTable from "@/app/components/RuntimeTable";
export default function TablePage() { const { table } = useParams<{ table: string }>(); const query=useSearchParams(),id = Number(query.get("row")); return <RuntimeTable key={table} table={table} initialRow={Number.isSafeInteger(id) && id>0 ? id : undefined} initialEdit={query.get("edit")==="1"}/>; }
