import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Handle,
  Position,
  BaseEdge,
  getSmoothStepPath,
  ReactFlowProvider,
  type NodeProps,
  type EdgeProps,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  UserPlus,
  PhoneOutgoing,
  BrainCircuit,
  DatabaseZap,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

// -- types --

type StepNodeData = {
  icon: LucideIcon;
  label: string;
  title: string;
  kind: "trigger" | "action";
  color: string;
};

type StepNode = Node<StepNodeData, "step">;

// -- constants --

const NODE_WIDTH = 220;
const NODE_GAP = 100;
const START_Y = 40;

const DEMO_NODES: StepNode[] = [
  {
    id: "1",
    type: "step",
    position: { x: 0, y: START_Y },
    data: {
      icon: UserPlus,
      label: "Trigger",
      title: "New Lead",
      kind: "trigger",
      color: "#7c5cfc",
    },
  },
  {
    id: "2",
    type: "step",
    position: { x: 0, y: START_Y + NODE_GAP },
    data: {
      icon: PhoneOutgoing,
      label: "Action",
      title: "Auto-Dial",
      kind: "action",
      color: "#3b82f6",
    },
  },
  {
    id: "3",
    type: "step",
    position: { x: 0, y: START_Y + NODE_GAP * 2 },
    data: {
      icon: BrainCircuit,
      label: "Action",
      title: "AI Coaching",
      kind: "action",
      color: "#ec4899",
    },
  },
  {
    id: "4",
    type: "step",
    position: { x: 0, y: START_Y + NODE_GAP * 3 },
    data: {
      icon: DatabaseZap,
      label: "Action",
      title: "Log to CRM",
      kind: "action",
      color: "#10b981",
    },
  },
  {
    id: "5",
    type: "step",
    position: { x: 0, y: START_Y + NODE_GAP * 4 },
    data: {
      icon: RotateCcw,
      label: "Action",
      title: "Follow Up",
      kind: "action",
      color: "#f59e0b",
    },
  },
];

const DEMO_EDGES: Edge[] = [
  { id: "e1-2", source: "1", target: "2", type: "smoothstep" },
  { id: "e2-3", source: "2", target: "3", type: "smoothstep" },
  { id: "e3-4", source: "3", target: "4", type: "smoothstep" },
  { id: "e4-5", source: "4", target: "5", type: "smoothstep" },
];

// -- custom node --

function StepNodeComponent({ data }: NodeProps<StepNode>) {
  const Icon = data.icon;

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        style={{ opacity: 0, pointerEvents: "none" }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: NODE_WIDTH,
          padding: "10px 14px",
          borderRadius: 8,
          border: "1px solid var(--color-border)",
          background: "var(--color-surface-0)",
          cursor: "grab",
          fontFamily: "var(--font-sans)",
        }}
        role="listitem"
        aria-label={`${data.label}: ${data.title}`}
      >
        {/* icon */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `${data.color}18`,
            flexShrink: 0,
          }}
        >
          <Icon size={16} color={data.color} strokeWidth={1.5} />
        </div>

        {/* text */}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: data.color,
              lineHeight: 1,
            }}
          >
            {data.label}
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "var(--color-fg)",
              marginTop: 3,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {data.title}
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
    </>
  );
}

// -- custom edge --

function SmoothEdge(props: EdgeProps) {
  const [path] = getSmoothStepPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
    borderRadius: 16,
  });

  return (
    <BaseEdge
      path={path}
      style={{ stroke: "var(--color-border)", strokeWidth: 1.5 }}
    />
  );
}

// -- main component --

const nodeTypes = { step: StepNodeComponent };
const edgeTypes = { smoothstep: SmoothEdge };

function WorkflowCanvas() {
  const nodes = useMemo(() => DEMO_NODES, []);
  const edges = useMemo(() => DEMO_EDGES, []);

  const onInit = useCallback((instance: { fitView: () => void }) => {
    instance.fitView();
  }, []);

  return (
    <div
      style={{ width: "100%", height: 600, borderRadius: 12, overflow: "hidden" }}
      role="list"
      aria-label="Workflow steps"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={onInit}
        nodesDraggable
        panOnDrag
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        fitView
        minZoom={0.5}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        style={{
          // reset xyflow defaults
          ["--xy-node-border-radius" as string]: "none",
          ["--xy-node-border" as string]: "none",
          ["--xy-node-background-color" as string]: "none",
          ["--xy-node-boxshadow-hover" as string]: "none",
          ["--xy-node-boxshadow-selected" as string]: "none",
        }}
      >
        <Background color="var(--color-border)" size={1.5} gap={20} />
      </ReactFlow>
    </div>
  );
}

export function HowItWorks() {
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-6">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            How it works
          </h2>
          <p className="mt-4 text-(--color-muted)">
            Drag the nodes around. This is the same workflow engine that powers
            Consuelo.
          </p>
        </div>

        <ReactFlowProvider>
          <WorkflowCanvas />
        </ReactFlowProvider>
      </div>
    </section>
  );
}
