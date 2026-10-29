// Shared types for Untangle. Everything the app stores lives in `Store`.

export type Category =
  | "bug"
  | "known_issue"
  | "idea"
  | "needs_detail"
  | "not_actionable";

export type Confidence = "high" | "medium" | "low";

export interface TestStep {
  id: string; // e.g. "S4"
  number: number;
  name: string;
  instruction: string;
  expected: string;
}

export interface KnownIssue {
  id: string;
  title: string;
  description: string;
  stepId: string;
}

export interface Message {
  from: "manager" | "tester";
  text: string;
  at: string;
}

export interface Report {
  id: string;
  tester: string;
  stepId: string;
  comment: string;
  browser?: string;
  createdAt: string;
  /** Kind questions from the manager and the tester's replies. */
  thread?: Message[];
  /** Set when the tester themselves said "this is the same as group X". */
  testerConfirmedGroupId?: string;
}

/** One piece of evidence shown to the manager ("show your working"). */
export interface Signal {
  text: string;
  strength: "strong" | "medium" | "weak";
}

export interface TicketDraft {
  title: string;
  stepsToReproduce: string[];
  expected: string;
  actual: string[];
  severity: "High" | "Medium" | "Low";
  environment: string[];
}

export type GroupStatus =
  | "pending" // waiting for a person
  | "approved" // ticket created by a person
  | "question_sent" // waiting on the tester
  | "logged_idea"
  | "closed_known"
  | "closed";

export interface Group {
  id: string;
  reportIds: string[];
  stepId: string;

  /** What the tool suggested, and what is in force now (a person may overrule). */
  aiCategory: Category;
  category: Category;
  categoryOverridden: boolean;
  categoryConfidence: Confidence;
  categoryReasons: Signal[];

  /** Only for groups with 2+ reports. */
  groupConfidence: Confidence | null;
  groupReasons: Signal[];
  /** Honest list of what is missing / what would make us surer. */
  missingEvidence: string[];
  /** Normalised terms that appear in 2+ reports — highlighted in the UI. */
  sharedTerms: string[];
  /** reportId -> how well it matches the rest of the group (0..1). */
  memberScores: Record<string, number>;

  knownIssueId?: string;
  relatedGroups: { id: string; score: number }[];

  draft?: TicketDraft;
  draftEditedByPerson?: boolean;
  question?: string; // kind question for thin feedback
  outcomeNote?: string; // what the tester sees once decided
  plainExplanation?: string; // one-paragraph "why" (AI-written when AI is on)
  aiWritten?: boolean;

  status: GroupStatus;
  ticketId?: string;
  /** A person changed the membership; automatic re-grouping leaves it alone. */
  locked: boolean;
}

export interface LogEntry {
  id: string;
  at: string;
  actor: "UAT manager" | "Tester" | "System";
  action: string;
  detail: string;
  groupId?: string;
  reason?: string;
  /** What the tool had suggested, when a person decided otherwise. */
  toolSuggested?: string;
}

export interface Store {
  appName: string;
  steps: TestStep[];
  knownIssues: KnownIssue[];
  reports: Report[];
  groups: Group[];
  log: LogEntry[];
  /** Pairs of report ids a person said are NOT the same. */
  cannotLink: [string, string][];
  nextTicket: number;
  nextId: number;
}

export const CATEGORY_LABEL: Record<Category, string> = {
  bug: "Bug",
  known_issue: "Already known",
  idea: "Idea, not a bug",
  needs_detail: "Needs more detail",
  not_actionable: "Not actionable",
};

export const STATUS_LABEL: Record<GroupStatus, string> = {
  pending: "To review",
  approved: "Ticket approved",
  question_sent: "Question sent",
  logged_idea: "Logged as idea",
  closed_known: "Linked to known issue",
  closed: "Closed with thanks",
};
