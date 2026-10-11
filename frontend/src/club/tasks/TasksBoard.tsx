import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ClipboardList, Plus, Trash2, User } from "lucide-react";
import { request, sanitizeErrorMessage } from "../api";

const FM = "'JetBrains Mono', monospace";
const FB = "'Manrope', sans-serif";

type Status = "TODO" | "IN_PROGRESS" | "DONE";
interface Task {
  id: string; title: string; description: string; status: Status; dueDate: string | null;
  assignedTo: { id: string; fullName: string; email: string } | null;
}
interface Progress { total: number; done: number; percent: number; overdueOpen: number; health: "NO_TASKS" | "COMPLETE" | "BEHIND" | "ON_TRACK"; label: string; summary: string }
interface Assignee { id: string; fullName: string; email: string }

const COLUMNS: Array<{ id: Status; label: string }> = [
  { id: "TODO", label: "To do" },
  { id: "IN_PROGRESS", label: "In progress" },
  { id: "DONE", label: "Done" },
];
const ORDER: Status[] = ["TODO", "IN_PROGRESS", "DONE"];
const HEALTH_COLOR: Record<Progress["health"], string> = { NO_TASKS: "#94a3b8", COMPLETE: "#10b981", BEHIND: "#F03D4E", ON_TRACK: "#10b981" };

interface Props { eventId: string; getToken: () => Promise<string | null>; isDark: boolean }

/**
 * Kanban board for an event's volunteer work (bake sale, fundraiser, anything a club splits up).
 * Tasks can be assigned to the club's active members; the server enforces who can see and change what.
 */
export default function TasksBoard({ eventId, getToken, isDark }: Props) {
  const text = isDark ? "#fff" : "#1e1b26";
  const sub = isDark ? "#94a3b8" : "#64748b";
  const card = { background: isDark ? "rgba(255,255,255,0.015)" : "#ffffff", border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.08)" } as const;
  const field = { background: isDark ? "rgba(255,255,255,0.03)" : "#e9ecf2", border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.1)", color: text } as const;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assignedToId, setAssignedToId] = useState("");

  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;
  const call = useCallback(async (path: string, init: RequestInit = {}) => request(path, init, (await tokenRef.current()) ?? undefined), []);

  const load = useCallback(async () => {
    try {
      const data = await call(`/tasks/event/${eventId}`);
      setTasks(data.tasks);
      setProgress(data.progress);
      setError(null);
    } catch (e) {
      setError(sanitizeErrorMessage(e, "Could not load tasks."));
    } finally {
      setLoading(false);
    }
  }, [call, eventId]);

  useEffect(() => {
    setLoading(true);
    load();
    call(`/tasks/event/${eventId}/assignees`).then(d => setAssignees(d.assignees)).catch(() => setAssignees([]));
  }, [load, call, eventId]);

  const create = async () => {
    setSaving(true);
    setError(null);
    try {
      await call(`/tasks/event/${eventId}`, {
        method: "POST",
        body: JSON.stringify({ title, description, assignedToId: assignedToId || undefined, dueDate: dueDate ? new Date(dueDate).toISOString() : undefined }),
      });
      setTitle(""); setDescription(""); setDueDate(""); setAssignedToId(""); setAdding(false);
      await load();
    } catch (e) {
      setError(sanitizeErrorMessage(e, "Could not add the task."));
    } finally {
      setSaving(false);
    }
  };

  const move = async (task: Task, dir: -1 | 1) => {
    const next = ORDER[ORDER.indexOf(task.status) + dir];
    if (!next) return;
    try {
      await call(`/tasks/${task.id}/status`, { method: "PUT", body: JSON.stringify({ status: next }) });
      await load();
    } catch (e) {
      setError(sanitizeErrorMessage(e, "Could not move the task."));
    }
  };

  const reassign = async (task: Task, userId: string) => {
    try {
      await call(`/tasks/${task.id}`, { method: "PUT", body: JSON.stringify({ assignedToId: userId }) });
      await load();
    } catch (e) {
      setError(sanitizeErrorMessage(e, "Could not assign the task."));
    }
  };

  const remove = async (task: Task) => {
    try {
      await call(`/tasks/${task.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(sanitizeErrorMessage(e, "Could not delete the task."));
    }
  };

  const now = Date.now();

  return (
    <section className="space-y-4" style={{ fontFamily: FB }} aria-label="Volunteer tasks">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-semibold" style={{ color: text }}><ClipboardList size={18} /> Volunteer tasks</h2>
          {progress && (
            <p className="text-sm mt-1" style={{ color: sub }} data-testid="task-progress">
              {progress.total === 0 ? "No tasks yet" : <>{progress.done}/{progress.total} tasks complete – <strong style={{ color: HEALTH_COLOR[progress.health] }}>{progress.label}</strong></>}
            </p>
          )}
        </div>
        <button onClick={() => setAdding(a => !a)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer" style={{ background: "#F03D4E" }}>
          <Plus size={14} /> {adding ? "Close" : "Add task"}
        </button>
      </div>

      {progress && progress.total > 0 && (
        <div className="h-2 rounded-full overflow-hidden" style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }} role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Tasks completed">
          <div style={{ width: `${progress.percent}%`, height: "100%", background: HEALTH_COLOR[progress.health], transition: "width .3s" }} />
        </div>
      )}

      {error && <div role="alert" className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(240,61,78,0.12)", color: "#F03D4E" }}>{error}</div>}

      {adding && (
        <div className="rounded-2xl p-4 space-y-3" style={card}>
          <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder="Task (e.g. Bake 60 cookies)" aria-label="Task title" className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={field} />
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Details (optional)" aria-label="Task details" className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-y" style={field} />
          <div className="flex flex-wrap gap-3">
            <select value={assignedToId} onChange={e => setAssignedToId(e.target.value)} aria-label="Assign to" className="rounded-xl px-3 py-2.5 text-sm outline-none min-w-[12rem]" style={field}>
              <option value="">Unassigned</option>
              {assignees.map(a => <option key={a.id} value={a.id}>{a.fullName}</option>)}
            </select>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} aria-label="Due date" className="rounded-xl px-3 py-2.5 text-sm outline-none" style={field} />
            <button onClick={create} disabled={!title.trim() || saving} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-50" style={{ background: "#F03D4E" }}>{saving ? "Adding…" : "Add"}</button>
          </div>
          {assignees.length === 0 && <p className="text-xs" style={{ color: sub }}>Only active club members can be assigned. Members appear here once their dues are verified.</p>}
        </div>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: sub }}>Loading tasks…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {COLUMNS.map(col => {
            const list = tasks.filter(t => t.status === col.id);
            return (
              <div key={col.id} className="rounded-2xl p-3 space-y-3" style={card} aria-label={`${col.label} tasks`}>
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] tracking-[0.2em] uppercase font-semibold" style={{ color: sub, fontFamily: FM }}>{col.label}</span>
                  <span className="text-xs" style={{ color: sub }}>{list.length}</span>
                </div>
                {list.length === 0 && <p className="text-xs px-1 py-3" style={{ color: sub }}>Nothing here.</p>}
                {list.map(t => {
                  const overdue = t.status !== "DONE" && t.dueDate && new Date(t.dueDate).getTime() < now;
                  return (
                    <article key={t.id} className="rounded-xl p-3 space-y-2" style={{ background: isDark ? "rgba(255,255,255,0.03)" : "#f4f5f9", border: overdue ? "1px solid rgba(240,61,78,0.5)" : "1px solid transparent" }}>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold min-w-0" style={{ color: text, overflowWrap: "anywhere" }}>{t.title}</h3>
                        <button onClick={() => remove(t)} aria-label={`Delete task ${t.title}`} className="p-1 rounded cursor-pointer shrink-0" style={{ color: "#F03D4E" }}><Trash2 size={13} /></button>
                      </div>
                      {t.description && <p className="text-xs" style={{ color: sub, overflowWrap: "anywhere" }}>{t.description}</p>}
                      <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: sub }}>
                        <User size={12} />
                        <select value={t.assignedTo?.id ?? ""} onChange={e => reassign(t, e.target.value)} aria-label={`Assignee for ${t.title}`} className="rounded-lg px-2 py-1 text-xs outline-none max-w-[10rem]" style={field}>
                          <option value="">Unassigned</option>
                          {t.assignedTo && !assignees.some(a => a.id === t.assignedTo!.id) && <option value={t.assignedTo.id}>{t.assignedTo.fullName}</option>}
                          {assignees.map(a => <option key={a.id} value={a.id}>{a.fullName}</option>)}
                        </select>
                        {t.dueDate && <span style={{ color: overdue ? "#F03D4E" : sub, fontWeight: overdue ? 700 : 400 }}>{overdue ? "Overdue · " : "Due "}{new Date(t.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}
                      </div>
                      <div className="flex gap-2">
                        <button disabled={t.status === "TODO"} onClick={() => move(t, -1)} aria-label={`Move ${t.title} back`} className="p-1.5 rounded-lg cursor-pointer disabled:opacity-30" style={field}><ChevronLeft size={14} /></button>
                        <button disabled={t.status === "DONE"} onClick={() => move(t, 1)} aria-label={`Move ${t.title} forward`} className="p-1.5 rounded-lg cursor-pointer disabled:opacity-30" style={field}><ChevronRight size={14} /></button>
                      </div>
                    </article>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
