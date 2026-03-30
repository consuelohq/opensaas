import { useCallback, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';

import { useGetBrowsingContext } from '@/ai/hooks/useBrowsingContext';
import { agentChatSelectedFilesState } from '@/ai/states/agentChatSelectedFilesState';
import { agentChatUploadedFilesState } from '@/ai/states/agentChatUploadedFilesState';
import { agentChatUsageState } from '@/ai/states/agentChatUsageState';
import { currentAIChatThreadState } from '@/ai/states/currentAIChatThreadState';

import { agentChatInputState } from '@/ai/states/agentChatInputState';
import { REST_API_BASE_URL } from '@/apollo/constant/rest-api-base-url';
import { getTokenPair } from '@/apollo/utils/getTokenPair';
import { renewToken } from '@/auth/services/AuthService';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { type ExtendedUIMessage } from 'twenty-shared/ai';
import { isDefined } from 'twenty-shared/utils';
import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { cookieStorage } from '~/utils/cookie-storage';

// SSE event types from pi's stream format (mapped by backend in Pi.9)
type SseTextEvent = { type: 'text'; content: string };
type SseToolCallEvent = {
  type: 'tool_call';
  id: string;
  name: string;
  args?: Record<string, unknown>;
};
type SseToolResultEvent = {
  type: 'tool_result';
  id: string;
  result: unknown;
};
type SseUsageEvent = {
  type: 'usage';
  inputTokens: number;
  outputTokens: number;
};
type SseSessionEvent = { type: 'session'; sessionId: string };
type SseDoneEvent = { type: 'done' };
type SseErrorEvent = { type: 'error'; message: string };

type SseEvent =
  | SseTextEvent
  | SseToolCallEvent
  | SseToolResultEvent
  | SseUsageEvent
  | SseSessionEvent
  | SseDoneEvent
  | SseErrorEvent;

// tool part shape compatible with ToolStepRenderer (matches ToolUIPart from ai package)
type PiToolPart = {
  type: `tool-${string}`;
  toolCallId: string;
  toolName: string;
  input: unknown;
  output?: unknown;
  state: 'call' | 'result';
};

type MessagePart = { type: 'text'; text: string } | PiToolPart;

const generateId = () => crypto.randomUUID();

const parseSseLine = (line: string): SseEvent | null => {
  if (!line.startsWith('data: ')) return null;

  try {
    return JSON.parse(line.slice(6)) as SseEvent;
  } catch {
    return null;
  }
};

export const useAgentChat = (uiMessages: ExtendedUIMessage[]) => {
  const setTokenPair = useSetRecoilState(tokenPairState);
  const setAgentChatUsage = useSetRecoilState(agentChatUsageState);
  const { getBrowsingContext } = useGetBrowsingContext();
  const agentChatSelectedFiles = useRecoilValue(agentChatSelectedFilesState);
  const currentAIChatThread = useRecoilValue(currentAIChatThreadState);
  const [agentChatUploadedFiles, setAgentChatUploadedFiles] = useRecoilState(
    agentChatUploadedFilesState,
  );
  const [agentChatInput, setAgentChatInput] =
    useRecoilState(agentChatInputState);

  const [streamingMessages, setStreamingMessages] = useState<
    ExtendedUIMessage[]
  >([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastUserMessageRef = useRef<string>('');

  // merge DB messages with any in-flight streaming messages, de-duplicating by id
  const messages: ExtendedUIMessage[] =
    streamingMessages.length > 0
      ? (() => {
          const existingIds = new Set(uiMessages.map((m) => m.id));
          const uniqueStreaming = streamingMessages.filter(
            (m) => !existingIds.has(m.id),
          );
          return [...uiMessages, ...uniqueStreaming];
        })()
      : uiMessages;

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const token = getTokenPair()?.accessOrWorkspaceAgnosticToken.token;

    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const retryWithRenewedToken = useCallback(
    async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response | null> => {
      const tokenPair = getTokenPair();

      if (!isDefined(tokenPair)) return null;

      try {
        const renewed = await renewToken(
          `${REACT_APP_SERVER_BASE_URL}/metadata`,
          tokenPair,
        );

        if (!isDefined(renewed)) {
          setTokenPair(null);

          return null;
        }

        const accessToken = renewed.accessOrWorkspaceAgnosticToken?.token;

        if (!isDefined(accessToken)) {
          setTokenPair(null);

          return null;
        }

        cookieStorage.setItem('tokenPair', JSON.stringify(renewed));
        setTokenPair(renewed);

        const headers = new Headers(init?.headers ?? {});

        headers.set('Authorization', `Bearer ${accessToken}`);

        return fetch(input, { ...init, headers });
      } catch {
        setTokenPair(null);

        return null;
      }
    },
    [setTokenPair],
  );

  const streamResponse = useCallback(
    async (content: string) => {
      if (!currentAIChatThread) return;

      setError(undefined);
      setIsStreaming(true);

      const controller = new AbortController();

      abortControllerRef.current = controller;

      const browsingContext = getBrowsingContext();

      // add user message to streaming state
      const userMsg: ExtendedUIMessage = {
        id: generateId(),
        role: 'user',
        parts: [{ type: 'text', text: content }],
      };

      const assistantId = generateId();
      const assistantMsg: ExtendedUIMessage = {
        id: assistantId,
        role: 'assistant',
        parts: [],
      };

      setStreamingMessages([userMsg, assistantMsg]);

      try {
        const url = `${REST_API_BASE_URL}/agent-chat/stream`;
        const init: RequestInit = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            threadId: currentAIChatThread,
            messages: [...uiMessages, userMsg],
            browsingContext,
          }),
          signal: controller.signal,
        };

        let response = await fetch(url, init);

        if (response.status === 401) {
          const retried = await retryWithRenewedToken(url, init);

          if (retried) {
            response = retried;
          }
        }

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          const err = new Error(
            errorBody.messages?.[0] ||
              `Request failed with status ${response.status}`,
          ) as Error & { code?: string };

          if (isDefined(errorBody.code)) {
            err.code = errorBody.code;
          }
          throw err;
        }

        const reader = response.body?.getReader();

        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        // mutable state for building the assistant message parts
        const parts: MessagePart[] = [];
        let usageData:
          | { inputTokens: number; outputTokens: number }
          | undefined;

        const updateAssistant = () => {
          setStreamingMessages([
            userMsg,
            {
              id: assistantId,
              role: 'assistant',
              parts: [...parts],
              metadata: usageData
                ? {
                    createdAt: new Date().toISOString(),
                    usage: {
                      inputTokens: usageData.inputTokens,
                      outputTokens: usageData.outputTokens,
                      cachedInputTokens: 0,
                      inputCredits: 0,
                      outputCredits: 0,
                      conversationSize: 0,
                    },
                  }
                : undefined,
            } as ExtendedUIMessage,
          ]);
        };

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');

          // keep the last incomplete line in the buffer
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const event = parseSseLine(line.trim());

            if (!event) continue;

            switch (event.type) {
              case 'text': {
                // append to existing text part or create new one
                const lastPart = parts[parts.length - 1];

                if (lastPart && lastPart.type === 'text') {
                  lastPart.text += event.content;
                } else {
                  parts.push({ type: 'text', text: event.content });
                }
                updateAssistant();
                break;
              }

              case 'tool_call': {
                parts.push({
                  type: `tool-${event.name}`,
                  toolCallId: event.id,
                  toolName: event.name,
                  input: event.args ?? {},
                  state: 'call',
                });
                updateAssistant();
                break;
              }

              case 'tool_result': {
                // find the matching tool part and update it
                const toolPart = parts.find(
                  (p): p is PiToolPart =>
                    p.type !== 'text' &&
                    'toolCallId' in p &&
                    p.toolCallId === event.id,
                );

                if (toolPart) {
                  toolPart.output = event.result;
                  toolPart.state = 'result';
                }
                updateAssistant();
                break;
              }

              case 'usage': {
                usageData = {
                  inputTokens: event.inputTokens,
                  outputTokens: event.outputTokens,
                };
                updateAssistant();

                setAgentChatUsage((prev) => ({
                  lastMessage: {
                    inputTokens: event.inputTokens,
                    outputTokens: event.outputTokens,
                    cachedInputTokens: 0,
                    inputCredits: 0,
                    outputCredits: 0,
                  },
                  conversationSize: prev?.conversationSize ?? 0,
                  contextWindowTokens: prev?.contextWindowTokens ?? 0,
                  inputTokens: (prev?.inputTokens ?? 0) + event.inputTokens,
                  outputTokens: (prev?.outputTokens ?? 0) + event.outputTokens,
                  inputCredits: prev?.inputCredits ?? 0,
                  outputCredits: prev?.outputCredits ?? 0,
                }));
                break;
              }

              case 'error': {
                throw new Error(event.message);
              }

              case 'done': {
                // stream complete — reconcile buffer with persisted messages
                setStreamingMessages([]);
                return;
              }
              case 'session':
                break;
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // user stopped the stream — not an error
        } else {
          const message =
            err instanceof Error ? err.message : 'Streaming failed';

          console.error('[useAgentChat] Streaming error:', err);
          setError(new Error(message));
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [
      currentAIChatThread,
      getBrowsingContext,
      getAuthHeaders,
      retryWithRenewedToken,
      setAgentChatUsage,
    ],
  );

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleRetry = useCallback(() => {
    if (lastUserMessageRef.current) {
      // clear the failed streaming messages and retry
      setStreamingMessages([]);
      streamResponse(lastUserMessageRef.current);
    }
  }, [streamResponse]);

  const isLoading = isStreaming || agentChatSelectedFiles.length > 0;

  const handleSendMessage = useCallback(async () => {
    if (agentChatInput.trim() === '' || isLoading || !currentAIChatThread) {
      return;
    }

    const content = agentChatInput.trim();

    setAgentChatInput('');
    lastUserMessageRef.current = content;
    setAgentChatUploadedFiles([]);

    await streamResponse(content);
  }, [
    agentChatInput,
    isLoading,
    currentAIChatThread,
    setAgentChatInput,
    setAgentChatUploadedFiles,
    streamResponse,
  ]);

  return {
    messages,
    handleSendMessage,
    handleStop,
    isLoading,
    isStreaming,
    error,
    handleRetry,
  };
};
