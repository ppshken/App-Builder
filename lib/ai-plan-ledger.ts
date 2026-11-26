import { randomUUID } from "node:crypto";
import { db } from "./db";
import type { AiDataDesign, AiRequirementReview } from "./ai-data-design";

type Scope = { appId:string; workspaceId:string; actorId:number };
const exists = () => !!db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='_ai_reviewed_plans'").get();
const approvalsExist = () => !!db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='_ai_plan_approvals'").get();
const payloadsExist = () => !!db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='_ai_plan_payloads'").get();
const cancellationsExist = () => !!db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='_ai_plan_cancellations'").get();
const activePlanGuard = () => cancellationsExist() ? " AND id NOT IN (SELECT plan_id FROM _ai_plan_cancellations)" : "";
const scopeValues = (scope: Scope) => [scope.appId,scope.workspaceId,scope.actorId];

export function registerAiPlan(scope: Scope, fingerprint: string, design: AiDataDesign, review?: AiRequirementReview) {
  return db.transaction(() => {
    db.exec(`CREATE TABLE IF NOT EXISTS _ai_reviewed_plans (
      id TEXT PRIMARY KEY, app_id TEXT NOT NULL, workspace_id TEXT NOT NULL, actor_id INTEGER NOT NULL,
      kind TEXT NOT NULL, fingerprint TEXT NOT NULL, reviewed_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
      approved_at INTEGER, receipt_id TEXT
    )`);
    const now = Date.now();
    db.exec(`CREATE TABLE IF NOT EXISTS _ai_plan_payloads (
      plan_id TEXT PRIMARY KEY REFERENCES _ai_reviewed_plans(id) ON DELETE CASCADE,
      design_json TEXT NOT NULL, review_json TEXT
    )`);
    db.prepare("DELETE FROM _ai_plan_payloads WHERE plan_id IN (SELECT id FROM _ai_reviewed_plans WHERE expires_at<=?)").run(now);
    const authorizationGuard = approvalsExist() ? " AND id NOT IN (SELECT plan_id FROM _ai_plan_approvals)" : "";
    db.prepare("DELETE FROM _ai_reviewed_plans WHERE approved_at IS NULL AND expires_at<=?" + authorizationGuard + activePlanGuard()).run(now);
    const count = db.prepare("SELECT COUNT(*) AS total FROM _ai_reviewed_plans WHERE app_id=? AND workspace_id=? AND actor_id=? AND approved_at IS NULL AND expires_at>?" + activePlanGuard())
      .get(...scopeValues(scope),now) as {total:number};
    if (count.total >= 50) throw Error("มีแผนรอยืนยันครบ 50 แผนแล้ว กรุณาใช้แผนเดิมหรือรอผลตรวจหมดอายุ");
    const id = randomUUID(), expiresAt = now + 15 * 60_000;
    db.prepare("INSERT INTO _ai_reviewed_plans(id,app_id,workspace_id,actor_id,kind,fingerprint,reviewed_at,expires_at) VALUES(?,?,?,?,?,?,?,?)")
      .run(id,...scopeValues(scope),design.requirement ? "required" : "schema",fingerprint,now,expiresAt);
    db.prepare("INSERT INTO _ai_plan_payloads(plan_id,design_json,review_json) VALUES(?,?,?)")
      .run(id,JSON.stringify(design),review ? JSON.stringify(review) : null);
    return {planId:id,expiresAt};
  })();
}

export function validAiPlan(scope: Scope, planId: unknown, fingerprint: unknown) {
  return typeof planId === "string" && typeof fingerprint === "string" && exists() &&
    !!db.prepare("SELECT 1 FROM _ai_reviewed_plans WHERE id=? AND app_id=? AND workspace_id=? AND actor_id=? AND fingerprint=? AND expires_at>? AND approved_at IS NULL" + activePlanGuard())
      .get(planId,...scopeValues(scope),fingerprint,Date.now());
}

export function authorizeAiPlan(scope:Scope,planId:unknown,fingerprint:unknown) {
  if (typeof planId !== "string" || !validAiPlan(scope,planId,fingerprint)) return false;
  return db.transaction(() => {
    db.exec(`CREATE TABLE IF NOT EXISTS _ai_plan_approvals (
      plan_id TEXT PRIMARY KEY REFERENCES _ai_reviewed_plans(id) ON DELETE CASCADE,
      authorized_at INTEGER NOT NULL
    )`);
    db.prepare("INSERT OR IGNORE INTO _ai_plan_approvals(plan_id,authorized_at) VALUES(?,?)").run(planId,Date.now());
    return true;
  })();
}

export function isAiPlanAuthorized(scope:Scope,planId:unknown,fingerprint:unknown) {
  return validAiPlan(scope,planId,fingerprint) && approvalsExist() &&
    !!db.prepare("SELECT 1 FROM _ai_plan_approvals WHERE plan_id=?").get(planId);
}

export function completeAiPlan(scope: Scope, planId: string, receiptId: string) {
  const result = db.prepare("UPDATE _ai_reviewed_plans SET approved_at=?,receipt_id=? WHERE id=? AND app_id=? AND workspace_id=? AND actor_id=? AND approved_at IS NULL")
    .run(Date.now(),receiptId,planId,...scopeValues(scope));
  if (!result.changes) throw Error("บันทึกหลักฐานการยืนยันไม่สำเร็จ");
  if (payloadsExist()) db.prepare("DELETE FROM _ai_plan_payloads WHERE plan_id=?").run(planId);
}

export function resumeAiPlan(scope: Scope, planId: string) {
  if (!exists() || !approvalsExist() || !payloadsExist()) return undefined;
  const row = db.prepare(`SELECT p.fingerprint,p.expires_at AS expiresAt,d.design_json,d.review_json
    FROM _ai_reviewed_plans p JOIN _ai_plan_approvals a ON a.plan_id=p.id
    JOIN _ai_plan_payloads d ON d.plan_id=p.id
    WHERE p.id=? AND p.app_id=? AND p.workspace_id=? AND p.actor_id=? AND p.expires_at>? AND p.approved_at IS NULL`)
    .get(planId,...scopeValues(scope),Date.now()) as {fingerprint:string;expiresAt:number;design_json:string;review_json:string|null}|undefined;
  if (!row) return undefined;
  return {design:JSON.parse(row.design_json) as AiDataDesign,
    review:{...(row.review_json ? JSON.parse(row.review_json) as AiRequirementReview : {}),planId,fingerprint:row.fingerprint,expiresAt:row.expiresAt}};
}

export function listAiPlans(scope: Scope) {
  if (!exists()) return [];
  const authorization = approvalsExist()
    ? "(SELECT authorized_at FROM _ai_plan_approvals WHERE plan_id=_ai_reviewed_plans.id)" : "NULL";
  const payload = payloadsExist()
    ? "EXISTS (SELECT 1 FROM _ai_plan_payloads WHERE plan_id=_ai_reviewed_plans.id)" : "0";
  const cancellation = cancellationsExist()
    ? "(SELECT cancelled_at FROM _ai_plan_cancellations WHERE plan_id=_ai_reviewed_plans.id)" : "NULL";
  return db.prepare(`SELECT id AS planId, kind, reviewed_at AS reviewedAt, expires_at AS expiresAt,
    ${authorization} AS authorizedAt, ${payload} AS hasPayload, ${cancellation} AS cancelledAt,
    approved_at AS approvedAt, receipt_id AS receiptId FROM _ai_reviewed_plans
    WHERE app_id=? AND workspace_id=? AND actor_id=? ORDER BY reviewed_at DESC, rowid DESC LIMIT 20`).all(...scopeValues(scope));
}

export function cancelAiPlan(scope:Scope,planId:unknown) {
  if (typeof planId !== "string" || !exists()) return null;
  return db.transaction(() => {
    const plan = db.prepare("SELECT expires_at FROM _ai_reviewed_plans WHERE id=? AND app_id=? AND workspace_id=? AND actor_id=? AND approved_at IS NULL")
      .get(planId,...scopeValues(scope)) as {expires_at:number}|undefined;
    if (!plan) return null;
    const previous = cancellationsExist() ? db.prepare("SELECT cancelled_at FROM _ai_plan_cancellations WHERE plan_id=?")
      .get(planId) as {cancelled_at:number}|undefined : undefined;
    if (previous) return previous.cancelled_at;
    const now = Date.now();
    if (plan.expires_at <= now) return null;
    db.exec(`CREATE TABLE IF NOT EXISTS _ai_plan_cancellations (
      plan_id TEXT PRIMARY KEY REFERENCES _ai_reviewed_plans(id) ON DELETE CASCADE,
      cancelled_at INTEGER NOT NULL
    )`);
    db.prepare("INSERT INTO _ai_plan_cancellations(plan_id,cancelled_at) VALUES(?,?)").run(planId,now);
    if (payloadsExist()) db.prepare("DELETE FROM _ai_plan_payloads WHERE plan_id=?").run(planId);
    return now;
  })();
}

export function ownsAppliedAiPlan(scope:Scope,planId:unknown): planId is string {
  return typeof planId === "string" && exists() &&
    !!db.prepare("SELECT 1 FROM _ai_reviewed_plans WHERE id=? AND app_id=? AND workspace_id=? AND actor_id=? AND receipt_id IS NOT NULL")
      .get(planId,...scopeValues(scope));
}
