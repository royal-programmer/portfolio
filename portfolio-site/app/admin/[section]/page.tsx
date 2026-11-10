import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllSettings } from "@/lib/settings/read";
import { GROUPS, isSettingKey } from "@/lib/settings/schema";
import { SettingEditor } from "../editor";

type Props = { params: Promise<{ section: string }>; searchParams: Promise<{ key?: string }> };

export default async function AdminSection({ params, searchParams }: Props) {
  const [{ section }, { key }] = await Promise.all([params, searchParams]);
  const group = GROUPS.find((g) => g.id === section);
  if (!group) notFound();
  const active = isSettingKey(key) && group.keys.includes(key) ? key : group.keys[0];
  const { tableReady, items } = await getAllSettings();
  const s = items[active];
  return (
    <>
      {group.keys.length > 1 ? (
        <nav className="adm-tabs" aria-label={`${group.label} settings`}>
          {group.keys.map((k) => (
            <Link key={k} href={`/admin/${group.id}?key=${k}`} aria-current={k === active ? "page" : undefined}>
              {k.replace("engineer.", "")}
              {items[k].differs ? <b /> : null}
            </Link>
          ))}
        </nav>
      ) : null}
      {/* key: a different setting starts from its own state */}
      <SettingEditor key={active} settingKey={active} title={group.label} draft={s.draft} live={s.live} fallback={s.fallback} stored={s.stored} tableReady={tableReady} updatedAt={s.updatedAt} />
    </>
  );
}
