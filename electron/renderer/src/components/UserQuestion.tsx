/**
 * UserQuestion Component
 * Dialog for ask_to_user tool - prompts user with options
 * Matches CLI's question format with 2-4 options + custom input
 */

import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import './UserQuestion.css';

export interface UserQuestionOption {
  id: string;
  label: string;
}

export interface UserQuestionData {
  id: string;
  question: string;
  options: UserQuestionOption[];
  allowCustom?: boolean;
}

interface UserQuestionProps {
  isOpen: boolean;
  question: UserQuestionData | null;
  onAnswer: (questionId: string, answer: string) => void;
  onCancel?: () => void;
}

const UserQuestion: React.FC<UserQuestionProps> = ({
  isOpen,
  question,
  onAnswer,
  onCancel,
}) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);

  // Reset state when question changes
  useEffect(() => {
    if (question) {
      setSelectedOption(null);
      setCustomInput('');
      setIsCustomMode(false);
    }
  }, [question?.id]);

  // Handle option select
  const handleOptionSelect = useCallback((optionId: string) => {
    if (optionId === 'custom') {
      setIsCustomMode(true);
      setSelectedOption(null);
    } else {
      setIsCustomMode(false);
      setSelectedOption(optionId);
    }
  }, []);

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (!question) return;

    if (isCustomMode && customInput.trim()) {
      onAnswer(question.id, customInput.trim());
    } else if (selectedOption) {
      const selected = question.options.find(o => o.id === selectedOption);
      if (selected) {
        onAnswer(question.id, selected.label);
      }
    }
  }, [question, isCustomMode, customInput, selectedOption, onAnswer]);

  // Handle keyboard
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip number key shortcuts when custom input is focused
      // This allows typing numbers in the custom input field
      const isInputFocused = document.activeElement?.tagName === 'INPUT';

      if (e.key === 'Escape') {
        // Don't close on Escape - user must explicitly cancel or submit
        // onCancel?.();
        return;
      } else if (e.key === 'Enter') {
        if (isCustomMode && customInput.trim()) {
          handleSubmit();
        } else if (selectedOption) {
          handleSubmit();
        }
      } else if (e.key >= '1' && e.key <= '4' && question && !isInputFocused) {
        // Only handle number keys when NOT typing in input field
        const index = parseInt(e.key) - 1;
        if (index < question.options.length) {
          handleOptionSelect(question.options[index].id);
        } else if (index === question.options.length && question.allowCustom !== false) {
          handleOptionSelect('custom');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isCustomMode, customInput, selectedOption, question, handleSubmit, handleOptionSelect, onCancel]);

  // Memoize canSubmit
  const canSubmit = useMemo(() => {
    return isCustomMode ? customInput.trim().length > 0 : selectedOption !== null;
  }, [isCustomMode, customInput, selectedOption]);

  if (!isOpen || !question) return null;

  return (
    <div className="user-question-backdrop">
      <div className="user-question-dialog">
        {/* Header */}
        <div className="user-question-header">
          <div className="question-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
            </svg>
          </div>
          <span>Question from Assistant</span>
        </div>

        {/* Question Text */}
        <div className="user-question-content">
          <p className="question-text">{question.question}</p>
        </div>

        {/* Options */}
        <div className="user-question-options">
          {question.options.map((option, index) => (
            <button
              key={option.id}
              className={`question-option ${selectedOption === option.id ? 'selected' : ''}`}
              onClick={() => handleOptionSelect(option.id)}
            >
              <span className="option-number">{index + 1}</span>
              <span className="option-label">{option.label}</span>
              {selectedOption === option.id && (
                <svg className="option-check" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
              )}
            </button>
          ))}

          {/* Custom Input Option */}
          {question.allowCustom !== false && (
            <button
              className={`question-option custom ${isCustomMode ? 'selected' : ''}`}
              onClick={() => handleOptionSelect('custom')}
            >
              <span className="option-number">{question.options.length + 1}</span>
              <span className="option-label">Other (custom input)</span>
              {isCustomMode && (
                <svg className="option-check" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
              )}
            </button>
          )}
        </div>

        {/* Custom Input Field */}
        {isCustomMode && (
          <div className="custom-input-container">
            <input
              type="text"
              className="custom-input"
              placeholder="Enter your custom response..."
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              autoFocus
            />
          </div>
        )}

        {/* Footer */}
        <div className="user-question-footer">
          <span className="keyboard-hint">
            Press 1-{question.options.length + (question.allowCustom !== false ? 1 : 0)} to select, Enter to confirm
          </span>
          <div className="question-actions">
            {onCancel && (
              <button className="question-btn secondary" onClick={onCancel}>
                Cancel
              </button>
            )}
            <button
              className="question-btn primary"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(UserQuestion);
