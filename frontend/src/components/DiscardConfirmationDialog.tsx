import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';
import { useI18n } from '../context/I18nContext';

interface DiscardConfirmationProps {
  open: boolean;
  onClose: () => void;
  onDiscard: () => void;
  titleKey: string;
  messageKey: string;
  /**
   * Optional label overrides. Draft restoration reuses this dialog but the
   * two actions mean "discard draft" and "restore draft", not "cancel" and
   * "discard changes"; defaults preserve the existing discard-changes copy.
   */
  cancelLabelKey?: string;
  confirmLabelKey?: string;
  confirmColor?: 'error' | 'primary';
}

/**
 * Accessible confirmation dialog for unsaved-changes discard flow.
 * Used by the Modal component when isDirty=true and backdrop/Escape is triggered.
 */
export const DiscardConfirmationDialog: React.FC<DiscardConfirmationProps> = ({
  open,
  onClose,
  onDiscard,
  titleKey,
  messageKey,
  cancelLabelKey = 'common.cancel',
  confirmLabelKey = 'common.discard',
  confirmColor = 'error',
}) => {
  const { t } = useI18n();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t(titleKey)}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ pt: 1 }}>{t(messageKey)}</Typography>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose} color="inherit">{t(cancelLabelKey)}</Button>
        <Button onClick={onDiscard} variant="contained" color={confirmColor} autoFocus>
          {t(confirmLabelKey)}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
