import { SettingsOptionCardContentSelect } from '@/settings/components/SettingsOptions/SettingsOptionCardContentSelect';
import { SettingsOptionCardContentToggle } from '@/settings/components/SettingsOptions/SettingsOptionCardContentToggle';
import { Select } from '@/ui/input/components/Select';
import { TextArea } from '@/ui/input/components/TextArea';
import { TextInput } from '@/ui/input/components/TextInput';
import styled from '@emotion/styled';
import { useCallback, useState } from 'react';
import {
  H2Title,
  IconBolt,
  IconCheck,
  IconKey,
  IconMessage,
  IconPlayerPlay,
  IconRobot,
  IconSettings,
  IconX,
} from 'twenty-ui/display';
import { Button } from 'twenty-ui/input';
import { Card, Section } from 'twenty-ui/layout';

// -- types & constants --

type Provider = 'groq' | 'openai';

type AIModel = {
  id: string;
  name: string;
  contextWindow: number;
  recommended?: boolean;
  speed: 'fast' | 'medium' | 'slow';
};

type AIProvider = {
  id: Provider;
  name: string;
  models: AIModel[];
  apiBase: string;
  keyPrefix: string;
};

type CoachingConfig = {
  enableRealTime: boolean;
  enablePostCall: boolean;
  realTimeModel: string;
  postCallModel: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
};

type AIConfig = {
  provider: Provider;
  apiKey: string;
  model: string;
  coaching: CoachingConfig;
};

const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'groq',
    name: 'Groq',
    apiBase: 'https://api.groq.com/openai/v1',
    keyPrefix: 'gsk_',
    models: [
      {
        id: 'llama-3.1-70b-versatile',
        name: 'Llama 3.1 70B',
        contextWindow: 131072,
        recommended: true,
        speed: 'fast',
      },
      {
        id: 'llama-3.1-8b-instant',
        name: 'Llama 3.1 8B',
        contextWindow: 131072,
        speed: 'fast',
      },
      {
        id: 'mixtral-8x7b-32768',
        name: 'Mixtral 8x7B',
        contextWindow: 32768,
        speed: 'fast',
      },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    apiBase: 'https://api.openai.com/v1',
    keyPrefix: 'sk-',
    models: [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        contextWindow: 128000,
        recommended: true,
        speed: 'medium',
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        contextWindow: 128000,
        speed: 'fast',
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        contextWindow: 16385,
        speed: 'fast',
      },
    ],
  },
];

const STORAGE_KEY = 'consuelo_ai_config';

const DEFAULT_CONFIG: AIConfig = {
  provider: 'groq',
  apiKey: '',
  model: 'llama-3.1-70b-versatile',
  coaching: {
    enableRealTime: true,
    enablePostCall: true,
    realTimeModel: 'llama-3.1-8b-instant',
    postCallModel: 'llama-3.1-70b-versatile',
    temperature: 0.7,
    maxTokens: 1024,
    systemPrompt:
      'You are a helpful sales coach. Provide concise, actionable advice.',
  },
};

const loadConfig = (): AIConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
};

const saveConfig = (config: AIConfig) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
};

// -- styled --

const StyledKeyRow = styled.div`
  align-items: flex-end;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => `${theme.spacing(3)} ${theme.spacing(4)}`};
`;

const StyledTestRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(4)}`};
  background: ${({ theme }) => theme.background.secondary};
`;

const StyledTestResult = styled.span<{ success: boolean }>`
  color: ${({ success, theme }) =>
    success ? theme.color.green : theme.color.red};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledAdvancedToggle = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.font.color.secondary};
  cursor: pointer;
  font-size: ${({ theme }) => theme.font.size.sm};
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(4)}`};
  text-align: left;

  &:hover {
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledAdvancedContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(4)} ${theme.spacing(3)}`};
`;

const StyledFieldLabel = styled.label`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  margin-bottom: ${({ theme }) => theme.spacing(1)};
`;

const StyledField = styled.div`
  display: flex;
  flex-direction: column;
`;

const StyledSliderRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledSlider = styled.input`
  flex: 1;
`;

const StyledSliderValue = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  min-width: 30px;
`;

// -- component --

export const AIProviderSettings = () => {
  const [config, setConfig] = useState<AIConfig>(loadConfig);
  const [keyInput, setKeyInput] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const provider = AI_PROVIDERS.find((p) => p.id === config.provider)!;

  const update = useCallback(
    (patch: Partial<AIConfig>) => {
      const next = { ...config, ...patch };
      setConfig(next);
      saveConfig(next);
    },
    [config],
  );

  const updateCoaching = useCallback(
    (patch: Partial<CoachingConfig>) => {
      const next = {
        ...config,
        coaching: { ...config.coaching, ...patch },
      };
      setConfig(next);
      saveConfig(next);
    },
    [config],
  );

  const handleProviderChange = useCallback(
    (newProvider: Provider) => {
      const newProviderDef = AI_PROVIDERS.find((p) => p.id === newProvider)!;
      const recommended =
        newProviderDef.models.find((m) => m.recommended) ??
        newProviderDef.models[0];
      update({
        provider: newProvider,
        model: recommended.id,
        apiKey: '',
        coaching: {
          ...config.coaching,
          realTimeModel: newProviderDef.models.find(
            (m) => m.speed === 'fast',
          )!.id,
          postCallModel: recommended.id,
        },
      });
      setKeyInput('');
      setTestResult(null);
    },
    [config.coaching, update],
  );

  const handleSaveKey = useCallback(() => {
    if (!keyInput) return;
    update({ apiKey: keyInput });
    setKeyInput('');
    setTestResult(null);
  }, [keyInput, update]);

  const handleTestConnection = useCallback(async () => {
    const key = config.apiKey;
    if (!key) {
      setTestResult({ success: false, message: 'No API key saved' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    const start = Date.now();
    try {
      const res = await fetch(`${provider.apiBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: 'Say "connected" in one word.' }],
          max_tokens: 5,
        }),
      });
      const latency = Date.now() - start;
      if (res.ok) {
        setTestResult({
          success: true,
          message: `Connected — ${config.model} (${latency}ms)`,
        });
      } else {
        const body = await res.json().catch(() => null);
        setTestResult({
          success: false,
          message:
            body?.error?.message ?? `HTTP ${res.status}: ${res.statusText}`,
        });
      }
    } catch (err: unknown) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Connection failed',
      });
    } finally {
      setTesting(false);
    }
  }, [config.apiKey, config.model, provider.apiBase]);

  const providerOptions = AI_PROVIDERS.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  const modelOptions = provider.models.map((m) => ({
    value: m.id,
    label: `${m.name}${m.recommended ? ' ★' : ''} — ${m.speed}`,
  }));

  const maskedKey = config.apiKey
    ? `${config.apiKey.slice(0, 6)}${'•'.repeat(20)}`
    : '';

  return (
    <>
      {/* provider selection */}
      <Section>
        <H2Title
          title="AI Provider"
          description="Select your AI provider for coaching"
        />
        <Card rounded>
          <SettingsOptionCardContentSelect
            Icon={IconRobot}
            title="Provider"
            description={`Using ${provider.name} models`}
          >
            <Select
              dropdownId="ai-provider-select"
              value={config.provider}
              onChange={handleProviderChange}
              options={providerOptions}
              selectSizeVariant="small"
              dropdownWidth={200}
            />
          </SettingsOptionCardContentSelect>
        </Card>
      </Section>

      {/* api key */}
      <Section>
        <H2Title
          title="API Key"
          description={`Enter your ${provider.name} API key (starts with ${provider.keyPrefix})`}
        />
        <Card rounded>
          <StyledKeyRow>
            <TextInput
              value={keyInput}
              onChange={(text) => setKeyInput(text)}
              placeholder={maskedKey || `Paste ${provider.name} API key`}
              type="password"
              fullWidth
            />
            <Button
              title="Save"
              onClick={handleSaveKey}
              disabled={!keyInput}
              size="small"
            />
          </StyledKeyRow>
          <StyledTestRow>
            <Button
              title={testing ? 'Testing...' : 'Test Connection'}
              onClick={handleTestConnection}
              disabled={testing || !config.apiKey}
              size="small"
              variant="secondary"
              Icon={testing ? undefined : IconBolt}
            />
            {testResult && (
              <StyledTestResult success={testResult.success}>
                {testResult.success ? <IconCheck size={14} /> : <IconX size={14} />}{' '}
                {testResult.message}
              </StyledTestResult>
            )}
          </StyledTestRow>
        </Card>
      </Section>

      {/* model selection */}
      <Section>
        <H2Title
          title="Default Model"
          description="Used for real-time coaching. Post-call can use a different model."
        />
        <Card rounded>
          <SettingsOptionCardContentSelect
            Icon={IconSettings}
            title="Model"
            description={`${provider.models.find((m) => m.id === config.model)?.contextWindow?.toLocaleString() ?? '?'} token context`}
          >
            <Select
              dropdownId="ai-model-select"
              value={config.model}
              onChange={(model: string) => update({ model })}
              options={modelOptions}
              selectSizeVariant="small"
              dropdownWidth={260}
            />
          </SettingsOptionCardContentSelect>
        </Card>
      </Section>

      {/* coaching toggles */}
      <Section>
        <H2Title
          title="Coaching"
          description="Configure AI coaching behavior during and after calls"
        />
        <Card rounded>
          <SettingsOptionCardContentToggle
            Icon={IconBolt}
            title="Real-time coaching"
            description="Get AI suggestions during live calls"
            checked={config.coaching.enableRealTime}
            onChange={(checked) =>
              updateCoaching({ enableRealTime: checked })
            }
            divider
          />
          <SettingsOptionCardContentToggle
            Icon={IconMessage}
            title="Post-call analysis"
            description="Automatic call summary and insights after each call"
            checked={config.coaching.enablePostCall}
            onChange={(checked) =>
              updateCoaching({ enablePostCall: checked })
            }
          />
        </Card>
      </Section>

      {/* advanced settings */}
      <Section>
        <H2Title
          title="Advanced"
          description="Fine-tune model behavior and coaching prompts"
        />
        <Card rounded>
          <StyledAdvancedToggle onClick={() => setShowAdvanced(!showAdvanced)}>
            {showAdvanced ? '▼' : '▶'} Advanced Settings
          </StyledAdvancedToggle>
          {showAdvanced && (
            <StyledAdvancedContent>
              <StyledField>
                <StyledFieldLabel>Real-time Model</StyledFieldLabel>
                <Select
                  dropdownId="ai-realtime-model"
                  value={config.coaching.realTimeModel}
                  onChange={(model: string) =>
                    updateCoaching({ realTimeModel: model })
                  }
                  options={modelOptions}
                  selectSizeVariant="small"
                  dropdownWidth={260}
                />
              </StyledField>
              <StyledField>
                <StyledFieldLabel>Post-call Model</StyledFieldLabel>
                <Select
                  dropdownId="ai-postcall-model"
                  value={config.coaching.postCallModel}
                  onChange={(model: string) =>
                    updateCoaching({ postCallModel: model })
                  }
                  options={modelOptions}
                  selectSizeVariant="small"
                  dropdownWidth={260}
                />
              </StyledField>
              <StyledField>
                <StyledFieldLabel>
                  Temperature: {config.coaching.temperature}
                </StyledFieldLabel>
                <StyledSliderRow>
                  <StyledSlider
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={config.coaching.temperature}
                    onChange={(e) =>
                      updateCoaching({
                        temperature: parseFloat(e.target.value),
                      })
                    }
                  />
                  <StyledSliderValue>
                    {config.coaching.temperature}
                  </StyledSliderValue>
                </StyledSliderRow>
              </StyledField>
              <StyledField>
                <StyledFieldLabel>Max Tokens</StyledFieldLabel>
                <TextInput
                  value={String(config.coaching.maxTokens)}
                  onChange={(text) => {
                    const n = parseInt(text, 10);
                    if (!isNaN(n) && n >= 100 && n <= 4096) {
                      updateCoaching({ maxTokens: n });
                    }
                  }}
                  placeholder="1024"
                />
              </StyledField>
              <StyledField>
                <StyledFieldLabel>System Prompt</StyledFieldLabel>
                <TextArea
                  textAreaId="ai-system-prompt"
                  value={config.coaching.systemPrompt}
                  onChange={(value) =>
                    updateCoaching({ systemPrompt: value })
                  }
                  placeholder="You are a helpful sales coach..."
                  minRows={3}
                />
              </StyledField>
            </StyledAdvancedContent>
          )}
        </Card>
      </Section>
    </>
  );
};
