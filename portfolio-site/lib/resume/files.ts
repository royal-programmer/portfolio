/**
 * The two résumés. `submitted` is the hand-made PDF Ratul uploads (the admin console's media library
 * will own it); `generated` is the data-built one (`/resume.pdf`, `resume --build`).
 */
export const RESUME_FILES = {
  submitted: { href: "/Ratul_Roy_Resume.pdf", label: "submitted · Nov 2026", updatedAt: "2026-11" },
  generated: { route: "/resume.pdf" },
} as const;

export type ResumeFiles = { submitted: { href: string; label: string; updatedAt: string }; generated: { route: string } };
