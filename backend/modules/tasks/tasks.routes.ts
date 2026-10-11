import { Router, Request, Response } from 'express';
import { Role, TaskStatus } from '@prisma/client';
import { prisma } from '../../config/db';
import { requireAuth } from '../../middlewares/authenticate';
import { requireClubManager, assertClubAccess, canManageClub, currentUser } from '../../middlewares/authorize';
import { badRequest, forbidden, notFound } from '../../middlewares/errorHandler';
import { oneOf, optDate, requiredStr, str } from '../../utils/params';
import { audit } from '../../utils/audit';
import { activeMemberIds } from '../memberships/membership.service';

/**
 * Volunteer task board for an event (fundraisers, bake sales, anything a club splits up).
 * Club heads create, assign and manage tasks for their own club's events; Super Admin for any.
 * A volunteer can move the status of a task assigned to them. Totals come from the counters on
 * Event (taskCount / taskDoneCount), so the progress bar needs no counting query.
 */
const router = Router();

const STATUSES = Object.values(TaskStatus);

const taskInclude = {
  assignedTo: { select: { id: true, fullName: true, email: true } },
  createdBy: { select: { id: true, fullName: true } },
} as const;

/** Progress shown above the board: "8/10 tasks complete – On Track". */
export function taskProgress(total: number, done: number, overdueOpen: number) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const health = total === 0 ? 'NO_TASKS' : done === total ? 'COMPLETE' : overdueOpen > 0 ? 'BEHIND' : 'ON_TRACK';
  const label = { NO_TASKS: 'No tasks yet', COMPLETE: 'All done', BEHIND: 'Behind schedule', ON_TRACK: 'On Track' }[health];
  return { total, done, percent, overdueOpen, health, label, summary: total === 0 ? label : `${done}/${total} tasks complete – ${label}` };
}

async function loadEvent(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, name: true, clubId: true, taskCount: true, taskDoneCount: true } });
  if (!event) throw notFound('Event not found.');
  return event;
}

/** A task can go to a club head of this club or an active member of it. */
async function assertAssignable(clubId: string, userId: string) {
  const person = await prisma.profile.findUnique({ where: { id: userId }, select: { id: true, role: true, clubId: true, isActive: true } });
  if (!person || !person.isActive) throw badRequest('That person could not be found.');
  if (person.role === Role.CLUB_HEAD && person.clubId === clubId) return;
  const members = await activeMemberIds(clubId, [userId]);
  if (!members.has(userId)) throw badRequest('Tasks can only be assigned to active members of this club.');
}

// ─── Board for one event ──────────────────────────────────────────────────────

router.get('/event/:eventId', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const event = await loadEvent(str(req.params.eventId));
  assertClubAccess(user, event.clubId);

  const tasks = await prisma.eventTask.findMany({ where: { eventId: event.id }, include: taskInclude, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  const now = new Date();
  const overdueOpen = tasks.filter(t => t.status !== 'DONE' && t.dueDate && t.dueDate < now).length;
  const board = { TODO: [] as typeof tasks, IN_PROGRESS: [] as typeof tasks, DONE: [] as typeof tasks };
  for (const t of tasks) board[t.status].push(t);

  return res.status(200).json({
    event: { id: event.id, name: event.name },
    progress: taskProgress(event.taskCount, event.taskDoneCount, overdueOpen),
    tasks,
    board,
  });
});

/** Who can be given a task: active members of the club plus its club head(s). */
router.get('/event/:eventId/assignees', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const event = await loadEvent(str(req.params.eventId));
  assertClubAccess(user, event.clubId);
  const now = new Date();
  const [members, heads] = await Promise.all([
    prisma.membership.findMany({
      where: { clubId: event.clubId, status: 'ACTIVE', endDate: { gt: now } },
      select: { user: { select: { id: true, fullName: true, email: true, isActive: true } } },
      distinct: ['userId'],
      orderBy: { userId: 'asc' },
    }),
    prisma.profile.findMany({ where: { clubId: event.clubId, role: Role.CLUB_HEAD, isActive: true }, select: { id: true, fullName: true, email: true } }),
  ]);
  const byId = new Map<string, { id: string; fullName: string; email: string }>();
  for (const h of heads) byId.set(h.id, h);
  for (const m of members) if (m.user.isActive) byId.set(m.user.id, { id: m.user.id, fullName: m.user.fullName, email: m.user.email });
  const assignees = [...byId.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));
  return res.status(200).json({ assignees });
});

router.post('/event/:eventId', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const event = await loadEvent(str(req.params.eventId));
  assertClubAccess(user, event.clubId);

  const title = requiredStr(req.body.title, 'Task title', 120);
  const description = str(req.body.description).slice(0, 2000);
  const dueDate = optDate(req.body.dueDate, 'dueDate') ?? null;
  const assignedToId = str(req.body.assignedToId) || null;
  if (assignedToId) await assertAssignable(event.clubId, assignedToId);

  const task = await prisma.eventTask.create({
    data: { eventId: event.id, title, description, dueDate, assignedToId, createdById: user.id },
    include: taskInclude,
  });
  if (assignedToId && assignedToId !== user.id) {
    await prisma.notification.create({
      data: { userId: assignedToId, eventId: event.id, type: 'task_assigned', title: 'New volunteer task', body: `You were assigned "${title}" for ${event.name}.` },
    });
  }
  await audit(user.id, 'CREATE_TASK', 'EventTask', task.id, { eventId: event.id, title });
  return res.status(201).json({ task });
});

// ─── A volunteer's own tasks ──────────────────────────────────────────────────

router.get('/mine', requireAuth, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const tasks = await prisma.eventTask.findMany({
    where: { assignedToId: user.id },
    include: { event: { select: { id: true, name: true, eventDate: true, club: { select: { id: true, name: true } } } } },
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    take: 100,
  });
  return res.status(200).json({ tasks });
});

// ─── One task ─────────────────────────────────────────────────────────────────

async function loadTask(req: Request) {
  const user = currentUser(req);
  const task = await prisma.eventTask.findUnique({ where: { id: str(req.params.id) }, include: { event: { select: { id: true, name: true, clubId: true } } } });
  if (!task) throw notFound('Task not found.');
  return { user, task, manager: canManageClub(user, task.event.clubId) };
}

/** The assigned volunteer or a club manager can move a task between columns. */
router.put('/:id/status', requireAuth, async (req: Request, res: Response): Promise<any> => {
  const { user, task, manager } = await loadTask(req);
  if (!manager && task.assignedToId !== user.id) throw forbidden('Only the assigned volunteer or the club can update this task.');
  const status = oneOf(req.body.status, STATUSES, 'status');
  if (!status) throw badRequest(`status must be one of: ${STATUSES.join(', ')}.`);
  const updated = await prisma.eventTask.update({ where: { id: task.id }, data: { status }, include: taskInclude });
  await audit(user.id, 'UPDATE_TASK_STATUS', 'EventTask', task.id, { from: task.status, to: status });
  return res.status(200).json({ task: updated });
});

router.put('/:id', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  const { user, task } = await loadTask(req);
  assertClubAccess(user, task.event.clubId);

  const data: Record<string, unknown> = {};
  if (req.body.title !== undefined) data.title = requiredStr(req.body.title, 'Task title', 120);
  if (req.body.description !== undefined) data.description = str(req.body.description).slice(0, 2000);
  if (req.body.dueDate !== undefined) data.dueDate = optDate(req.body.dueDate, 'dueDate') ?? null;
  if (req.body.status !== undefined) {
    const status = oneOf(req.body.status, STATUSES, 'status');
    if (!status) throw badRequest(`status must be one of: ${STATUSES.join(', ')}.`);
    data.status = status;
  }
  let newlyAssigned: string | null = null;
  if (req.body.assignedToId !== undefined) {
    const id = str(req.body.assignedToId) || null;
    if (id) await assertAssignable(task.event.clubId, id);
    data.assignedToId = id;
    if (id && id !== task.assignedToId && id !== user.id) newlyAssigned = id;
  }
  const updated = await prisma.eventTask.update({ where: { id: task.id }, data, include: taskInclude });
  if (newlyAssigned) {
    await prisma.notification.create({
      data: { userId: newlyAssigned, eventId: task.event.id, type: 'task_assigned', title: 'New volunteer task', body: `You were assigned "${updated.title}" for ${task.event.name}.` },
    });
  }
  await audit(user.id, 'UPDATE_TASK', 'EventTask', task.id, { fields: Object.keys(data) });
  return res.status(200).json({ task: updated });
});

router.delete('/:id', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  const { user, task } = await loadTask(req);
  assertClubAccess(user, task.event.clubId);
  await prisma.eventTask.delete({ where: { id: task.id } });
  await audit(user.id, 'DELETE_TASK', 'EventTask', task.id, { eventId: task.event.id, title: task.title });
  return res.status(200).json({ deleted: true });
});

export default router;
