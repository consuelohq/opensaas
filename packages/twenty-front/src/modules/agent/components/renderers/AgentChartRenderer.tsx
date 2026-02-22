import styled from '@emotion/styled';
import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type ChartInput = {
  chartType: 'bar' | 'line' | 'pie';
  data: Array<Record<string, unknown>>;
  title?: string;
  xKey?: string;
  yKey?: string;
};

type AgentChartRendererProps = {
  input: ChartInput;
};

const CHART_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
];

const StyledWrapper = styled.div`
  padding: ${({ theme }) => theme.spacing(3)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  background: ${({ theme }) => theme.background.primary};
`;

const StyledTitle = styled.div`
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
`;

export const AgentChartRenderer = ({ input }: AgentChartRendererProps) => {
  const { chartType, data, title, xKey = 'name', yKey = 'value' } = input;

  const chart = useMemo(() => {
    if (chartType === 'pie') {
      return (
        <PieChart>
          <Pie data={data} dataKey={yKey} nameKey={xKey} cx="50%" cy="50%">
            {data.map((_, index) => (
              <Cell
                key={index}
                fill={CHART_COLORS[index % CHART_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      );
    }

    if (chartType === 'line') {
      return (
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey={yKey} stroke="#3b82f6" />
        </LineChart>
      );
    }

    return (
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xKey} />
        <YAxis />
        <Tooltip />
        <Bar dataKey={yKey} fill="#3b82f6" />
      </BarChart>
    );
  }, [chartType, data, xKey, yKey]);

  return (
    <StyledWrapper>
      {title && <StyledTitle>{title}</StyledTitle>}
      <ResponsiveContainer width="100%" height={300}>
        {chart}
      </ResponsiveContainer>
    </StyledWrapper>
  );
};
