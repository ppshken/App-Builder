import { builderUpdates } from "@/lib/builder-updates";
import "./updates.css";

const groups = [["added", "เพิ่มใหม่"], ["improved", "ปรับปรุง"], ["fixed", "แก้ไข"]] as const;

export default function BuilderUpdatesPage() {
  return <section className="builder-updates" aria-labelledby="builder-updates-title">
    <header className="page-heading">
      <div>
        <h1 id="builder-updates-title">อัปเดต App Builder</h1>
        <p>ประวัติฟีเจอร์ใหม่ การปรับปรุง และการแก้ไขของแพลตฟอร์ม App Builder</p>
      </div>
    </header>
    {builderUpdates.map(update => <article className="panel builder-update-entry" key={update.date + update.title}>
      <header>
        <time className="hint" dateTime={update.date}>{update.dateLabel}</time>
        <h2>{update.title}</h2>
      </header>
      <div className="builder-update-groups">
        {groups.map(([key, label]) => update[key].length > 0 && <section key={key}>
          <h3><span>{label}</span></h3>
          <ul>{update[key].map(item => <li key={item}>{item}</li>)}</ul>
        </section>)}
      </div>
    </article>)}
  </section>;
}
