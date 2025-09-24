import { useEffect, useState } from 'react';
import { acknowledgeError, acknowledgeWarning, type DebugIssue, getDebugStatus } from '~/lib/api/debug';

const ACKNOWLEDGED_DEBUG_ISSUES_KEY = 'upage_acknowledged_debug_issues';

const getAcknowledgedIssues = (): string[] => {
  try {
    const stored = localStorage.getItem(ACKNOWLEDGED_DEBUG_ISSUES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const setAcknowledgedIssues = (issueIds: string[]) => {
  try {
    localStorage.setItem(ACKNOWLEDGED_DEBUG_ISSUES_KEY, JSON.stringify(issueIds));
  } catch (error) {
    console.error('Failed to persist acknowledged debug issues:', error);
  }
};

export const useDebugStatus = () => {
  const [hasActiveWarnings, setHasActiveWarnings] = useState(false);
  const [activeIssues, setActiveIssues] = useState<DebugIssue[]>([]);
  const [acknowledgedIssueIds, setAcknowledgedIssueIds] = useState<string[]>(() => getAcknowledgedIssues());

  const checkDebugStatus = async () => {
    try {
      const status = await getDebugStatus();
      const issues: DebugIssue[] = [
        ...status.warnings.map((w) => ({ ...w, type: 'warning' as const })),
        ...status.errors.map((e) => ({ ...e, type: 'error' as const })),
      ].filter((issue) => !acknowledgedIssueIds.includes(issue.id));

      setActiveIssues(issues);
      setHasActiveWarnings(issues.length > 0);
    } catch (error) {
      console.error('Failed to check debug status:', error);
    }
  };

  useEffect(() => {
    // Check immediately and then every 5 seconds
    checkDebugStatus();

    const interval = setInterval(checkDebugStatus, 5 * 1000);

    return () => clearInterval(interval);
  }, [acknowledgedIssueIds]);

  const acknowledgeIssue = async (issue: DebugIssue) => {
    try {
      if (issue.type === 'warning') {
        await acknowledgeWarning(issue.id);
      } else {
        await acknowledgeError(issue.id);
      }

      const newAcknowledgedIds = [...acknowledgedIssueIds, issue.id];
      setAcknowledgedIssueIds(newAcknowledgedIds);
      setAcknowledgedIssues(newAcknowledgedIds);
      setActiveIssues((prev) => prev.filter((i) => i.id !== issue.id));
      setHasActiveWarnings(activeIssues.length > 1);
    } catch (error) {
      console.error('Failed to acknowledge issue:', error);
    }
  };

  const acknowledgeAllIssues = async () => {
    try {
      await Promise.all(
        activeIssues.map((issue) =>
          issue.type === 'warning' ? acknowledgeWarning(issue.id) : acknowledgeError(issue.id),
        ),
      );

      const newAcknowledgedIds = [...acknowledgedIssueIds, ...activeIssues.map((i) => i.id)];
      setAcknowledgedIssueIds(newAcknowledgedIds);
      setAcknowledgedIssues(newAcknowledgedIds);
      setActiveIssues([]);
      setHasActiveWarnings(false);
    } catch (error) {
      console.error('Failed to acknowledge all issues:', error);
    }
  };

  return { hasActiveWarnings, activeIssues, acknowledgeIssue, acknowledgeAllIssues };
};
