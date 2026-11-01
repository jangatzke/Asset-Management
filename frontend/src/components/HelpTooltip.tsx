import { useState } from 'react';
import type { ReactNode } from 'react';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useI18n } from '../context/I18nContext';

export interface HelpTooltipProps {
  /** i18n key for the optional tooltip heading. */
  labelKey?: string;
  /** i18n key for the tooltip explanation text. */
  bodyKey?: string;
  /** Plain-text fallback used when no i18n body key is supplied. */
  children?: ReactNode;
  /** i18n key providing the accessible name of the trigger button. */
  ariaLabelKey?: string;
}

/**
 * Accessible help affordance for ambiguous form fields.
 *
 * - The trigger is a real `<button>` (MUI `IconButton`) with an `aria-label`
 *   sourced from i18n (`ariaLabelKey`, default `common.help.ariaLabel`).
 * - MUI `Tooltip` is opened explicitly on focus/blur and hover so keyboard and
 *   pointer users reach the same copy. `describeChild` makes MUI set
 *   `aria-describedby` on the trigger while the tooltip is open. Focus is
 *   driven by React state rather than MUI's focus-visible heuristic, which is
 *   unreliable in jsdom and in some touch/browser combinations.
 * - No copy is hard-coded: the visible text comes from `labelKey`/`bodyKey`.
 *   `children` is only a plain-text fallback, so tests and ad-hoc usage do not
 *   need a translation catalog.
 */
const HelpTooltip = ({ labelKey, bodyKey, children: fallback, ariaLabelKey }: HelpTooltipProps) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const triggerLabel = t(ariaLabelKey ?? 'common.help.ariaLabel');
  const bodyText = bodyKey ? t(bodyKey) : undefined;
  const headingText = labelKey ? t(labelKey) : undefined;

  let title: string | undefined;
  if (headingText && bodyText) {
    title = `${headingText}: ${bodyText}`;
  } else if (bodyText) {
    title = bodyText;
  } else if (headingText) {
    title = headingText;
  } else if (typeof fallback === 'string' && fallback.trim() !== '') {
    title = fallback;
  }

  const hasContent = typeof title === 'string' && title.length > 0;

  return (
    <Tooltip title={title ?? ''} describeChild open={hasContent ? open : false}>
      <IconButton
        type="button"
        size="small"
        aria-label={triggerLabel}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onMouseOver={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="ml-1 align-middle text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <InfoOutlinedIcon fontSize="inherit" aria-hidden="true" />
      </IconButton>
    </Tooltip>
  );
};

export default HelpTooltip;
