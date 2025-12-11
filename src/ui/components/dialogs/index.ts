/**
 * Dialog Components Index
 *
 * Re-exports all dialog components for easy importing
 */

export {
  PlanApprovalPrompt,
  TaskApprovalPrompt,
  type ApprovalAction
} from './ApprovalDialog.js';

// Re-export with original names for backwards compatibility
export {
  PlanApprovalPrompt as ApprovalPrompt,
} from './ApprovalDialog.js';

export { SettingsBrowser as SettingsDialog } from './SettingsDialog.js';

// Re-export with original name for backwards compatibility
export { SettingsBrowser } from './SettingsDialog.js';
