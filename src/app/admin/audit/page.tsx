import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyAdminAuth } from "@/features/admin/utils/auth";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  if (!(await verifyAdminAuth()).authorized) redirect("/admin/login");
  const page = Math.max(1, Math.min(10000, Number((await searchParams).page) || 1));
  const { data, error } = await getSupabaseAdmin().from("audit_logs")
    .select("id, actor, action, target_type, target_id, created_at")
    .order("created_at", { ascending: false }).range((page - 1) * 25, page * 25);
  return <div className="space-y-6"><header><p className="text-primary text-xs uppercase tracking-widest">Owner portal</p>
    <h1 className="font-serif text-3xl mt-2">Audit activity</h1></header>
    {error ? <p role="alert" className="text-red-300">Activity could not be loaded.</p> : data?.length ?
      <ol className="space-y-3">{data.slice(0, 25).map((item) => <li key={item.id} className="border border-white/15 p-4 text-sm">
        <p className="text-muted text-xs">{new Date(item.created_at).toLocaleString()} · {item.actor}</p>
        <p className="capitalize">{item.action.replaceAll("_", " ")}</p>
        {item.target_type === "commission" && <Link href={`/admin/commissions/${item.target_id}`} className="text-primary underline">Open commission</Link>}
      </li>)}</ol> : <p className="text-muted">No audit entries yet.</p>}
    <div className="flex gap-4 text-primary text-sm">{page > 1 && <Link href={`/admin/audit?page=${page - 1}`}>Previous</Link>}
      {data?.length === 26 && <Link href={`/admin/audit?page=${page + 1}`}>Next</Link>}</div>
  </div>;
}
