import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { IconArrowUp, IconPlayerStop } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAgentSkills } from '@/agent/hooks/useAgentSkills';
import { useComposerRuntime, useThreadRuntime } from '@assistant-ui/react';

const StyledInputArea = styled.form`
  align-items: center;
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)} ${({ theme }) => theme.spacing(6)};
  position: relative;
`;

const StyledInput = styled.input`
  background: transparent;
  border: none;
  color: ${({ theme }) => theme.font.color.primary};
  flex: 1;
  font-family: inherit;
  font-size: ${({ theme }) => theme.font.size.md};
  outline: none;

  &::placeholder {
    color: ${({ theme }) => theme.font.color.tertiary};
  }
`;

const StyledSendButton = styled.button<{ disabled: boolean }>`
  align-items: center;
  background: ${({ theme, disabled }) =>
    disabled ? theme.background.transparent.light : theme.background.tertiary};
  border: none;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme, disabled }) =>
    disabled ? theme.font.color.extraLight : theme.font.color.primary};
  cursor: ${({ disabled }) => (disabled ? 'default' : 'pointer')};
  display: flex;
  height: 28px;
  justify-content: center;
  width: 28px;
`;

const StyledPopover = styled.div`
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  bottom: 100%;
  box-shadow: ${({ theme }) => theme.boxShadow.strong};
  left: ${({ theme }) => theme.spacing(6)};
  max-height: 200px;
  overflow-y: auto;
  position: absolute;
  right: ${({ theme }) => theme.spacing(6)};
  z-index: 10;
`;

const StyledPopoverHeader = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  padding: ${({ theme }) => theme.spacing(1.5)}
    ${({ theme }) => theme.spacing(2)};
  text-transform: uppercase;
`;

const StyledPopoverItem = styled.div<{ isHighlighted: boolean }>`
  align-items: center;
  background: ${({ theme, isHighlighted }) =>
    isHighlighted ? theme.background.transparent.light : 'transparent'};
  cursor: pointer;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(1.5)}
    ${({ theme }) => theme.spacing(2)};

  &:hover {
    background: ${({ theme }) => theme.background.transparent.lighter};
  }
`;

const StyledItemName = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledItemDescription = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

type SlashItem = {
  id: string;
  name: string;
  description: string | null;
  type: 'skill' | 'command';
};

export const AgentComposer = () => {
  const { t } = useLingui();
  const { skills } = useAgentSkills();
  const composerRuntime = useComposerRuntime();
  const threadRuntime = useThreadRuntime();

  const [input, setInput] = useState('');
  const [showSlash, setShowSlash] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const isRunning = threadRuntime.getState().isRunning;

  const slashItems = useMemo((): SlashItem[] => {
    const query = input.startsWith('/') ? input.slice(1).toLowerCase() : '';

    const commands: SlashItem[] = [
      {
        id: 'cmd-new-chat',
        name: 'new-chat',
        description: t`Start a new conversation`,
        type: 'command',
      },
      {
        id: 'cmd-create-skill',
        name: 'create-skill',
        description: t`Create a new skill`,
        type: 'command',
      },
    ];

    const skillItems: SlashItem[] = skills
      .filter((skill) => skill.enabled)
      .map((skill) => ({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        type: 'skill' as const,
      }));

    const all = [...commands, ...skillItems];

    if (query === '') {
      return all;
    }

    return all.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query),
    );
  }, [input, skills, t]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [slashItems.length]);

  const handleSelectItem = useCallback(
    (item: SlashItem) => {
      if (item.type === 'command' && item.id === 'cmd-new-chat') {
        setInput('');
        setShowSlash(false);

        return;
      }

      if (item.type === 'command' && item.id === 'cmd-create-skill') {
        // send as a message so the agent handles skill creation
        composerRuntime.setText('Create a new skill for me');
        composerRuntime.send();
        setInput('');
        setShowSlash(false);

        return;
      }

      // for skills, send as a message with the skill name
      const message = `/${item.name}`;

      composerRuntime.setText(message);
      composerRuntime.send();
      setInput('');
      setShowSlash(false);
    },
    [composerRuntime],
  );

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (showSlash) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightIndex((prev) =>
          prev < slashItems.length - 1 ? prev + 1 : 0,
        );

        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightIndex((prev) =>
          prev > 0 ? prev - 1 : slashItems.length - 1,
        );

        return;
      }

      if (event.key === 'Enter' && slashItems[highlightIndex]) {
        event.preventDefault();
        handleSelectItem(slashItems[highlightIndex]);

        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setShowSlash(false);

        return;
      }
    }

    if (event.key === 'Enter' && !event.shiftKey && !showSlash) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;

    setInput(value);
    setShowSlash(value.startsWith('/'));
  };

  const handleSubmit = () => {
    const trimmed = input.trim();

    if (trimmed === '' || isRunning) {
      return;
    }

    composerRuntime.setText(trimmed);
    composerRuntime.send();
    setInput('');
    setShowSlash(false);
  };

  const handleStop = () => {
    threadRuntime.cancelRun();
  };

  const onFormSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    handleSubmit();
  };

  return (
    <StyledInputArea onSubmit={onFormSubmit}>
      {showSlash && slashItems.length > 0 && (
        <StyledPopover>
          <StyledPopoverHeader>{t`Commands & Skills`}</StyledPopoverHeader>
          {slashItems.map((item, index) => (
            <StyledPopoverItem
              key={item.id}
              isHighlighted={index === highlightIndex}
              onClick={() => handleSelectItem(item)}
            >
              <StyledItemName>/{item.name}</StyledItemName>
              {item.description && (
                <StyledItemDescription>
                  {item.description}
                </StyledItemDescription>
              )}
            </StyledPopoverItem>
          ))}
        </StyledPopover>
      )}
      <StyledInput
        ref={inputRef}
        value={input}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={t`Message the Agent…`}
        autoFocus
      />
      {isRunning ? (
        <StyledSendButton type="button" disabled={false} onClick={handleStop}>
          <IconPlayerStop size={14} />
        </StyledSendButton>
      ) : (
        <StyledSendButton type="submit" disabled={input.trim() === ''}>
          <IconArrowUp size={14} />
        </StyledSendButton>
      )}
    </StyledInputArea>
  );
};
