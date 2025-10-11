import classNames from 'classnames';
import { IconButton } from '~/.client/components/ui/IconButton';

export const SpeechRecognitionButton = ({
  isListening,
  onStart,
  onStop,
  disabled,
}: {
  isListening: boolean;
  onStart: () => void;
  onStop: () => void;
  disabled: boolean;
}) => {
  return (
    <IconButton
      title={isListening ? 'Stop listening' : 'Start speech recognition'}
      disabled={disabled}
      className={classNames('transition-all', {
        'text-upage-elements-item-contentAccent': isListening,
      })}
      onClick={isListening ? onStop : onStart}
    >
      {isListening ? <div className="i-ph:microphone-slash text-xl" /> : <div className="i-ph:microphone text-xl" />}
    </IconButton>
  );
};
