import {
  GitBranch,
  ClipboardList,
  FileText,
  FlaskConical,
} from 'lucide-react';

export const navPrimary = [
  { to: '/dashboard', icon: FlaskConical, label: 'Analysis', end: true },
  { to: '/repositories', icon: GitBranch, label: 'Repos', end: false },
  { to: '/reviews', icon: ClipboardList, label: 'Reviews', end: true },
  { to: '/reports', icon: FileText, label: 'AI Reports', end: true },
];
