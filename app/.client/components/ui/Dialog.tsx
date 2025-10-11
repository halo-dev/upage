import * as RadixDialog from '@radix-ui/react-dialog';
import classNames from 'classnames';
import { motion, type Variants } from 'framer-motion';
import React, { memo, type ReactNode, useEffect, useMemo, useState } from 'react';
import { List, type RowComponentProps } from 'react-window';
import { cubicEasingFn } from '~/.client/utils/easings';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { IconButton } from './IconButton';
import { Label } from './Label';

export { Close as DialogClose, Root as DialogRoot } from '@radix-ui/react-dialog';

interface DialogButtonProps {
  type: 'primary' | 'secondary' | 'danger';
  children: ReactNode;
  onClick?: (event: React.MouseEvent) => void;
  disabled?: boolean;
}

export const DialogButton = memo(({ type, children, onClick, disabled }: DialogButtonProps) => {
  return (
    <button
      className={classNames(
        'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors',
        type === 'primary'
          ? 'bg-purple-500 text-white hover:bg-purple-600 dark:bg-purple-500 dark:hover:bg-purple-600'
          : type === 'secondary'
            ? 'bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
            : 'bg-transparent text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10',
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
});

export const DialogTitle = memo(({ className, children, ...props }: RadixDialog.DialogTitleProps) => {
  return (
    <RadixDialog.Title
      className={classNames('text-lg font-medium text-upage-elements-textPrimary flex items-center gap-2', className)}
      {...props}
    >
      {children}
    </RadixDialog.Title>
  );
});

export const DialogDescription = memo(({ className, children, ...props }: RadixDialog.DialogDescriptionProps) => {
  return (
    <RadixDialog.Description
      className={classNames('text-sm text-upage-elements-textSecondary mt-1', className)}
      {...props}
    >
      {children}
    </RadixDialog.Description>
  );
});

const transition = {
  duration: 0.15,
  ease: cubicEasingFn,
};

export const dialogBackdropVariants = {
  closed: {
    opacity: 0,
    transition,
  },
  open: {
    opacity: 1,
    transition,
  },
} satisfies Variants;

export const dialogVariants = {
  closed: {
    x: '-50%',
    y: '-40%',
    scale: 0.96,
    opacity: 0,
    transition,
  },
  open: {
    x: '-50%',
    y: '-50%',
    scale: 1,
    opacity: 1,
    transition,
  },
} satisfies Variants;

interface DialogProps {
  children: ReactNode;
  className?: string;
  showCloseButton?: boolean;
  onClose?: () => void;
  onBackdrop?: () => void;
}

export const Dialog = memo(({ children, className, showCloseButton = true, onClose, onBackdrop }: DialogProps) => {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay asChild>
        <motion.div
          className={classNames('fixed inset-0 z-[9999] bg-black/70 dark:bg-black/80 backdrop-blur-sm')}
          initial="closed"
          animate="open"
          exit="closed"
          variants={dialogBackdropVariants}
          onClick={onBackdrop}
        />
      </RadixDialog.Overlay>
      <RadixDialog.Content asChild>
        <motion.div
          className={classNames(
            'fixed top-1/2 overflow-hidden left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-950 rounded-lg shadow-xl border border-upage-elements-borderColor z-[9999] w-[520px]',
            className,
          )}
          initial="closed"
          animate="open"
          exit="closed"
          variants={dialogVariants}
        >
          <div className="flex flex-col">
            {children}
            {showCloseButton && (
              <RadixDialog.Close asChild onClick={onClose}>
                <IconButton
                  icon="i-ph:x"
                  className="absolute top-3 right-3 text-upage-elements-textTertiary hover:text-upage-elements-textSecondary"
                />
              </RadixDialog.Close>
            )}
          </div>
        </motion.div>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
});

/**
 * Props for the ConfirmationDialog component
 */
export interface ConfirmationDialogProps {
  /**
   * Whether the dialog is open
   */
  isOpen: boolean;

  /**
   * Callback when the dialog is closed
   */
  onClose: () => void;

  /**
   * Callback when the confirm button is clicked
   */
  onConfirm: () => void;

  /**
   * The title of the dialog
   */
  title: string;

  /**
   * The description of the dialog
   */
  description: string;

  /**
   * The text for the confirm button
   */
  confirmLabel?: string;

  /**
   * The text for the cancel button
   */
  cancelLabel?: string;

  /**
   * The variant of the confirm button
   */
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';

  /**
   * Whether the confirm button is in a loading state
   */
  isLoading?: boolean;
}

/**
 * A reusable confirmation dialog component that uses the Dialog component
 */
export function ConfirmationDialog({
  isOpen,
  onClose,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  isLoading = false,
  onConfirm,
}: ConfirmationDialogProps) {
  return (
    <RadixDialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog showCloseButton={false}>
        <div className="p-6 bg-white dark:bg-gray-950 relative z-10">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="mb-4">{description}</DialogDescription>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              {cancelLabel}
            </Button>
            <Button
              variant={variant}
              onClick={onConfirm}
              disabled={isLoading}
              className={
                variant === 'destructive'
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-upage-elements-item-backgroundAccent text-upage-elements-item-contentAccent hover:bg-upage-elements-button-primary-backgroundHover'
              }
            >
              {isLoading ? (
                <>
                  <div className="i-ph-spinner-gap-bold animate-spin size-4 mr-2" />
                  {confirmLabel}
                </>
              ) : (
                confirmLabel
              )}
            </Button>
          </div>
        </div>
      </Dialog>
    </RadixDialog.Root>
  );
}

/**
 * Type for selection item in SelectionDialog
 */
type SelectionItem = {
  id: string;
  label: string;
  description?: string;
};

/**
 * Props for the SelectionDialog component
 */
export interface SelectionDialogProps {
  /**
   * The title of the dialog
   */
  title: string;

  /**
   * The items to select from
   */
  items: SelectionItem[];

  /**
   * Whether the dialog is open
   */
  isOpen: boolean;

  /**
   * Callback when the dialog is closed
   */
  onClose: () => void;

  /**
   * Callback when the confirm button is clicked with selected item IDs
   */
  onConfirm: (selectedIds: string[]) => void;

  /**
   * The text for the confirm button
   */
  confirmLabel?: string;

  /**
   * The maximum height of the selection list
   */
  height?: number;
}

function RowComponent({
  items,
  index,
  style,
  selectedItems,
  onToggleItem,
}: RowComponentProps<{
  items: SelectionItem[];
  selectedItems: string[];
  onToggleItem: (id: string) => void;
}>) {
  const item = useMemo(() => items[index], [items, index]);

  return (
    <div
      className={classNames(
        'flex items-start space-x-3 p-2 rounded-md transition-colors',
        item.id
          ? 'bg-upage-elements-item-backgroundAccent'
          : 'bg-upage-elements-bg-depth-2 hover:bg-upage-elements-item-backgroundActive',
      )}
      style={{
        ...style,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <Checkbox
        id={`item-${item.id}`}
        checked={selectedItems.includes(item.id)}
        onCheckedChange={() => onToggleItem(item.id)}
      />
      <div className="grid gap-1.5 leading-none">
        <Label
          htmlFor={`item-${item.id}`}
          className={classNames(
            'text-sm font-medium cursor-pointer',
            selectedItems.includes(item.id)
              ? 'text-upage-elements-item-contentAccent'
              : 'text-upage-elements-textPrimary',
          )}
        >
          {item.label}
        </Label>
        {item.description && <p className="text-xs text-upage-elements-textSecondary">{item.description}</p>}
      </div>
    </div>
  );
}

/**
 * A reusable selection dialog component that uses the Dialog component
 */
export function SelectionDialog({
  title,
  items,
  isOpen,
  onClose,
  onConfirm,
  confirmLabel = 'Confirm',
  height = 60,
}: SelectionDialogProps) {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  // Reset selected items when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedItems([]);
      setSelectAll(false);
    }
  }, [isOpen]);

  const handleToggleItem = (id: string) => {
    setSelectedItems((prev) => (prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]));
  };

  const handleSelectAll = () => {
    if (selectedItems.length === items.length) {
      setSelectedItems([]);
      setSelectAll(false);
    } else {
      setSelectedItems(items.map((item) => item.id));
      setSelectAll(true);
    }
  };

  const handleConfirm = () => {
    onConfirm(selectedItems);
    onClose();
  };

  return (
    <RadixDialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog showCloseButton={false}>
        <div className="p-6 bg-white dark:bg-gray-950 relative z-10">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="mt-2 mb-4">
            Select the items you want to include and click{' '}
            <span className="text-upage-elements-item-contentAccent font-medium">{confirmLabel}</span>.
          </DialogDescription>

          <div className="py-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-upage-elements-textSecondary">
                {selectedItems.length} of {items.length} selected
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                className="text-xs h-8 px-2 text-upage-elements-textPrimary hover:text-upage-elements-item-contentAccent hover:bg-upage-elements-item-backgroundAccent bg-upage-elements-bg-depth-2 dark:bg-transparent"
              >
                {selectAll ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            <div className="pr-2 border rounded-md border-upage-elements-borderColor bg-upage-elements-bg-depth-2">
              {items.length > 0 ? (
                <List
                  rowCount={items.length}
                  rowHeight={height}
                  rowComponent={RowComponent}
                  rowProps={{ items, selectedItems, onToggleItem: handleToggleItem }}
                  className="scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-upage-elements-bg-depth-3"
                ></List>
              ) : (
                <div className="text-center py-4 text-sm text-upage-elements-textTertiary">No items to display</div>
              )}
            </div>
          </div>

          <div className="flex justify-between mt-6">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-upage-elements-borderColor text-upage-elements-textPrimary hover:bg-upage-elements-item-backgroundActive"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={selectedItems.length === 0}
              className="bg-accent-500 text-white hover:bg-accent-600 disabled:opacity-50 disabled:pointer-events-none"
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </Dialog>
    </RadixDialog.Root>
  );
}
