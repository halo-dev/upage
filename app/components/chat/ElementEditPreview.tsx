import { AnimatePresence, motion } from 'framer-motion';
import React, { useState } from 'react';
import type { ElementInfoMetadata } from '~/types/message';
import { cubicEasingFn } from '~/utils/easings';
import { ElementPreview } from './ElementPreview';

interface ElementEditPreviewProps {
  elementEditInfo: ElementInfoMetadata;
  className?: string;
}

export const ElementEditPreview: React.FC<ElementEditPreviewProps> = ({ elementEditInfo, className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div
      className={`element-edit-preview p-4 border border-upage-elements-borderColor rounded-lg bg-upage-elements-background-depth-1 shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between cursor-pointer" onClick={toggleExpand}>
        <div className="flex items-center gap-2">
          <div className="i-ph:code-block text-upage-elements-textSecondary"></div>
          <h3 className="text-sm font-medium text-upage-elements-textSecondary">
            编辑元素: {elementEditInfo.tagName.toLowerCase()}
            {elementEditInfo.className && `.${elementEditInfo.className.split(' ')[0]}`}
            {elementEditInfo.id && `#${elementEditInfo.id}`}
          </h3>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.3, ease: cubicEasingFn }}
          className="i-ph:caret-down text-upage-elements-textSecondary"
        />
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0, marginTop: 0 }}
            animate={{ height: 'auto', opacity: 1, marginTop: 12 }}
            exit={{ height: 0, opacity: 0, marginTop: 0 }}
            transition={{ duration: 0.3, ease: cubicEasingFn }}
            style={{ overflow: 'hidden' }}
          >
            <ElementPreview element={elementEditInfo} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
