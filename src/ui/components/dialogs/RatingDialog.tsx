/**
 * Rating Dialog
 *
 * 모델 평점 입력 UI (1-5)
 * 사용자가 1~5 키를 누르면 평점 제출
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

export interface RatingDialogProps {
  modelName: string;
  onSubmit: (rating: number) => void;
  onCancel: () => void;
}

/**
 * Rating Dialog - 1-5 평점 입력
 */
export const RatingDialog: React.FC<RatingDialogProps> = ({
  modelName,
  onSubmit,
  onCancel,
}) => {
  const [submitted, setSubmitted] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);

  useInput((input, key) => {
    if (submitted) return;

    // 1-5 숫자키 처리
    if (['1', '2', '3', '4', '5'].includes(input)) {
      const rating = parseInt(input, 10);
      setSelectedRating(rating);
      setSubmitted(true);
    }

    // ESC로 취소
    if (key.escape) {
      onCancel();
    }
  });

  // 제출 후 1.5초 뒤 자동 닫기
  useEffect(() => {
    if (submitted && selectedRating !== null) {
      const timer = setTimeout(() => {
        onSubmit(selectedRating);
      }, 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [submitted, selectedRating, onSubmit]);

  // 제출 완료 상태
  if (submitted && selectedRating !== null) {
    return (
      <Box flexDirection="column" paddingX={1} paddingY={1}>
        <Text color="green">Thanks for your feedback! (Rating: {selectedRating}/5)</Text>
      </Box>
    );
  }

  // 평점 입력 UI
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      paddingX={1}
      paddingY={1}
      marginY={1}
    >
      <Box marginBottom={1}>
        <Text color="yellow" bold>Rate your experience with </Text>
        <Text color="cyan" bold>{modelName}</Text>
      </Box>

      <Box>
        <Text>Press </Text>
        <Text color="cyan" bold>1-5</Text>
        <Text> to rate (1=Poor, 5=Excellent) or </Text>
        <Text color="gray">ESC</Text>
        <Text> to skip</Text>
      </Box>

      <Box marginTop={1}>
        {[1, 2, 3, 4, 5].map((num) => (
          <Box key={num} marginRight={2}>
            <Text color="yellow" bold>[{num}]</Text>
            <Text color="yellow"> {'★'.repeat(num)}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default RatingDialog;
