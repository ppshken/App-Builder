import {withAuth} from "@/lib/auth-api";
import {inspectOrRestore,cancelRestore} from "@/lib/backup-stages";
export const dynamic="force-dynamic";
export const POST=withAuth(inspectOrRestore);
export const DELETE=withAuth(cancelRestore);
