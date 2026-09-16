import React, { useState, useRef, useEffect } from "react";
import {
  Zap,
  Clock,
  Send,
  GitBranch,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  Play,
  Save,
  ArrowLeft,
  X,
  Sliders,
  Sparkles,
  Tag,
  ShoppingCart,
  Check,
  ChevronRight,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  MessageSquare,
  AlertTriangle,
  Gift,
  Eye,
  Calendar
} from "lucide-react";

export default function FlowchartCanvas({
  workflow,
  onSave,
  onClose,
  onSimulate,
  availableTemplates = [],
  availableCoupons = []
}) {
  const [flow, setFlow] = useState(() => {
    // Deep clone to allow local edits
    return JSON.parse(JSON.stringify(workflow));
  });

  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState(null); // { parentId, handle }
  const [pickerFilter, setPickerFilter] = useState("all");
  const [zoom, setZoom] = useState(1);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simPhone, setSimPhone] = useState("");
  const [simCartValue, setSimCartValue] = useState(650);
  const [simLog, setSimLog] = useState([]);
  const [simStepIndex, setSimStepIndex] = useState(-1);

  const selectedNode = (flow.nodes || []).find((n) => n.id === selectedNodeId);

  // Helper to update selected node data
  const updateSelectedNode = (key, value) => {
    if (!selectedNodeId) return;
    setFlow((prev) => {
      const updatedNodes = prev.nodes.map((node) => {
        if (node.id === selectedNodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              [key]: value
            }
          };
        }
        return node;
      });
      return { ...prev, nodes: updatedNodes };
    });
  };

  const updateSelectedNodeLabel = (newLabel) => {
    if (!selectedNodeId) return;
    setFlow((prev) => {
      const updatedNodes = prev.nodes.map((node) => {
        if (node.id === selectedNodeId) {
          return { ...node, label: newLabel };
        }
        return node;
      });
      return { ...prev, nodes: updatedNodes };
    });
  };

  // Add node from picker
  const handleAddNode = (stepTemplate) => {
    const newNodeId = `node_${Date.now()}`;
    const newNode = {
      id: newNodeId,
      type: stepTemplate.type,
      label: stepTemplate.defaultLabel,
      data: { ...stepTemplate.defaultData },
      position: { x: 280, y: 100 }
    };

    setFlow((prev) => {
      const updatedNodes = [...prev.nodes, newNode];
      let updatedEdges = [...prev.edges];

      if (pickerTarget) {
        // Connect parent to new node
        const newEdge = {
          id: `e_${pickerTarget.parentId}_${newNodeId}`,
          source: pickerTarget.parentId,
          target: newNodeId,
          ...(pickerTarget.handle ? { sourceHandle: pickerTarget.handle } : {})
        };
        updatedEdges.push(newEdge);
      }

      return {
        ...prev,
        nodes: updatedNodes,
        edges: updatedEdges
      };
    });

    setIsPickerOpen(false);
    setPickerTarget(null);
    setSelectedNodeId(newNodeId);
  };

  // Delete node and associated edges
  const handleDeleteNode = (nodeId) => {
    if (!nodeId) return;
    setFlow((prev) => {
      return {
        ...prev,
        nodes: prev.nodes.filter((n) => n.id !== nodeId),
        edges: prev.edges.filter((e) => e.source !== nodeId && e.target !== nodeId)
      };
    });
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
  };

  // Run simulated step animation
  const handleStartSimulation = async () => {
    if (!simPhone.trim()) {
      alert("Please enter a customer test phone number (e.g. +919876543210)");
      return;
    }
    setIsSimulating(true);
    setSimLog([]);
    setSimStepIndex(0);

    try {
      if (onSimulate) {
        const res = await onSimulate(flow.id, {
          customer_phone: simPhone,
          test_cart_value: Number(simCartValue),
          mock_mode: true
        });
        if (res && res.history) {
          setSimLog(res.history);
        }
      }
    } catch (err) {
      console.error("Simulation error:", err);
    }
  };

  // Picker categories
  const STEP_TEMPLATES = [
    {
      id: "whatsapp_message",
      type: "whatsapp_message",
      category: "action",
      title: "Send WhatsApp Template",
      desc: "Dispatches an approved WhatsApp promotional or utility template with dynamic discount coupons.",
      icon: MessageSquare,
      color: "text-[#25D366] bg-emerald-50 border-emerald-200",
      defaultLabel: "Send WhatsApp Message",
      defaultData: {
        template_name: availableTemplates[0]?.template_name || "abandoned_cart_recovery",
        coupon_code: availableCoupons[0]?.code || "BAZIK7",
        language: "en"
      }
    },
    {
      id: "delay",
      type: "delay",
      category: "timing",
      title: "Wait / Delay Timer",
      desc: "Pauses the customer journey for a specific duration (e.g. 30m, 24h) before the next step.",
      icon: Clock,
      color: "text-amber-600 bg-amber-50 border-amber-200",
      defaultLabel: "Wait 30 Mins",
      defaultData: {
        delay_minutes: 30,
        description: "Allows customer organic checkout time"
      }
    },
    {
      id: "condition_order",
      type: "condition",
      category: "condition",
      title: "Check: Did Customer Purchase?",
      desc: "Evaluates database if cart was recovered or new order completed. Branches into YES and NO.",
      icon: GitBranch,
      color: "text-purple-600 bg-purple-50 border-purple-200",
      defaultLabel: "Did Customer Purchase?",
      defaultData: {
        condition_type: "ORDER_PLACED",
        description: "Checks if order was placed"
      }
    },
    {
      id: "condition_read",
      type: "condition",
      category: "condition",
      title: "Check: Was Message Read?",
      desc: "Checks WhatsApp read receipt ticks (blue ticks) on the last dispatched message.",
      icon: Eye,
      color: "text-blue-600 bg-blue-50 border-blue-200",
      defaultLabel: "Was Message Read?",
      defaultData: {
        condition_type: "MESSAGE_READ",
        description: "Checks blue tick status"
      }
    },
    {
      id: "tag_contact",
      type: "tag",
      category: "action",
      title: "Tag Customer Profile",
      desc: "Appends a CRM tag to customer contact (e.g. 'VIP Patron', 'Cart Recovered').",
      icon: Tag,
      color: "text-indigo-600 bg-indigo-50 border-indigo-200",
      defaultLabel: "Tag 'Recovered Patron'",
      defaultData: {
        tag_name: "Recovered Patron"
      }
    },
    {
      id: "exit_goal",
      type: "exit",
      category: "exit",
      title: "Goal Converted / Success",
      desc: "Marks session as successfully converted, updates recovered revenue metrics and terminates flow.",
      icon: CheckCircle2,
      color: "text-emerald-700 bg-emerald-100 border-emerald-300",
      defaultLabel: "Goal: Cart Recovered! 🎉",
      defaultData: {
        outcome: "GOAL_MET",
        description: "Order completed successfully"
      }
    },
    {
      id: "exit_dropout",
      type: "exit",
      category: "exit",
      title: "Conclude Journey",
      desc: "Gracefully finishes the automated journey when maximum follow-up steps are exhausted.",
      icon: XCircle,
      color: "text-gray-600 bg-gray-100 border-gray-300",
      defaultLabel: "Journey Concluded",
      defaultData: {
        outcome: "DROPOUT",
        description: "No further automated follow-up"
      }
    }
  ];

  const filteredTemplates = STEP_TEMPLATES.filter((t) => {
    if (pickerFilter === "all") return true;
    return t.category === pickerFilter;
  });

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] bg-[#F8FAFC] border border-gray-200 rounded-2xl overflow-hidden shadow-lg relative">
      {/* ── TOP ACTION HEADER BAR ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3.5 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 text-gray-600 rounded-xl transition flex items-center gap-1.5 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Exit Builder</span>
          </button>

          <div className="h-5 w-[1px] bg-gray-200" />

          <div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={flow.name}
                onChange={(e) => setFlow({ ...flow, name: e.target.value })}
                className="font-bold text-gray-900 text-base hover:bg-gray-50 focus:bg-white border-b border-transparent focus:border-emerald-500 px-1 py-0.5 rounded outline-none transition"
              />
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {flow.trigger_type}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 pl-1">
              Visual Multi-Step Flowchart Journey • {flow.nodes?.length || 0} Steps
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Active Status Switch */}
          <button
            onClick={() => setFlow({ ...flow, is_active: !flow.is_active })}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition border ${
              flow.is_active
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-gray-100 text-gray-500 border-gray-300"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                flow.is_active ? "bg-emerald-500 animate-pulse" : "bg-gray-400"
              }`}
            />
            {flow.is_active ? "Live & Active" : "Paused / Draft"}
          </button>

          {/* Zoom buttons */}
          <div className="flex items-center bg-gray-100 rounded-xl p-0.5 border border-gray-200 text-xs">
            <button
              onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))}
              className="p-1.5 hover:bg-white rounded-lg text-gray-600 transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono text-[11px] text-gray-600 font-semibold">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(1.4, z + 0.1))}
              className="p-1.5 hover:bg-white rounded-lg text-gray-600 transition"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="p-1.5 hover:bg-white rounded-lg text-gray-600 transition"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Simulate button */}
          <button
            onClick={() => setIsSimulating(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold hover:bg-blue-100 transition shadow-xs"
          >
            <Play className="w-3.5 h-3.5 fill-blue-600" />
            Simulate Flow
          </button>

          {/* Save button */}
          <button
            onClick={() => onSave(flow)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#25D366] text-white rounded-xl text-xs font-bold hover:bg-[#1EBE5D] transition shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            Save Journey
          </button>
        </div>
      </div>

      {/* ── CANVAS WORKSPACE WITH DOT GRID PATTERN ── */}
      <div className="relative flex-1 overflow-auto bg-[#F8FAFC]">
        {/* SVG Dot Matrix Background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(#CBD5E1 1px, transparent 1px)",
            backgroundSize: "24px 24px"
          }}
        />

        {/* Canvas Scaled Content Container */}
        <div
          className="min-h-full min-w-full p-12 flex flex-col items-center justify-start transition-transform origin-top"
          style={{ transform: `scale(${zoom})` }}
        >
          {(() => {
            const allNodes = flow.nodes || [];
            const allEdges = flow.edges || [];

            // Helper to get edge target from source
            const getEdgeTarget = (sourceId, handle = null) => {
              const matched = allEdges.filter((e) => {
                if (String(e.source) !== String(sourceId)) return false;
                if (handle) {
                  return String(e.sourceHandle || "").toLowerCase() === handle.toLowerCase();
                }
                return true;
              });
              return matched.length > 0 ? matched[0].target : null;
            };

            // Single Node Card Renderer - Sleek, Compact, High-End SaaS Card
            const renderNodeCard = (node) => {
              const isSelected = selectedNodeId === node.id;
              const isTrigger = node.type === "trigger";
              const isDelay = node.type === "delay";
              const isWhatsApp =
                node.type === "whatsapp_message" ||
                node.type === "action_whatsapp" ||
                node.type === "whatsapp";
              const isCondition = node.type === "condition";
              const isTag = node.type === "tag";
              const isExit = node.type === "exit" || node.type === "goal";

              // Distinct theme colors per node type
              const theme = isTrigger
                ? { bg: "bg-blue-50", border: "border-blue-200", iconBg: "bg-blue-600 text-white", tag: "TRIGGER", tagColor: "text-blue-700 bg-blue-100" }
                : isDelay
                ? { bg: "bg-amber-50/50", border: "border-amber-200", iconBg: "bg-amber-500 text-white", tag: "DELAY", tagColor: "text-amber-800 bg-amber-100" }
                : isWhatsApp
                ? { bg: "bg-emerald-50/40", border: "border-emerald-200", iconBg: "bg-[#25D366] text-white", tag: "WHATSAPP", tagColor: "text-emerald-800 bg-emerald-100" }
                : isCondition
                ? { bg: "bg-purple-50/40", border: "border-purple-200", iconBg: "bg-purple-600 text-white", tag: "DECISION", tagColor: "text-purple-800 bg-purple-100" }
                : isTag
                ? { bg: "bg-indigo-50/40", border: "border-indigo-200", iconBg: "bg-indigo-600 text-white", tag: "TAG CRM", tagColor: "text-indigo-800 bg-indigo-100" }
                : node.data?.outcome === "GOAL_MET"
                ? { bg: "bg-emerald-50/60", border: "border-emerald-300", iconBg: "bg-emerald-600 text-white", tag: "GOAL MET", tagColor: "text-emerald-900 bg-emerald-200" }
                : { bg: "bg-gray-50", border: "border-gray-200", iconBg: "bg-gray-600 text-white", tag: "EXIT", tagColor: "text-gray-700 bg-gray-200" };

              // Subtitle summary
              let subtitle = "";
              if (isTrigger) subtitle = node.data?.trigger_type || "Abandoned Cart";
              else if (isDelay) {
                const mins = Number(node.data?.delay_minutes) || 30;
                subtitle = mins >= 1440 ? `${mins / 1440} Days wait` : mins >= 60 ? `${mins / 60} Hours wait` : `${mins} Mins wait`;
              } else if (isWhatsApp) {
                subtitle = `Template: ${node.data?.template_name || "cart_recovery_v1"}`;
              } else if (isCondition) {
                subtitle = node.data?.condition_type === "MESSAGE_READ" ? "Check blue ticks" : "Check order placed";
              } else if (isTag) {
                subtitle = `Tag: ${node.data?.tag_name || "Recovered Patron"}`;
              } else if (isExit) {
                subtitle = node.data?.outcome === "GOAL_MET" ? "Revenue Recovered 🎉" : "End journey";
              }

              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`group relative w-64 bg-white rounded-2xl border-2 transition-all cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5 ${
                    isSelected
                      ? "border-[#25D366] ring-4 ring-emerald-100 shadow-md"
                      : "border-gray-200/90 hover:border-gray-300"
                  }`}
                >
                  <div className="p-3.5 flex items-start gap-3">
                    {/* Leading Rounded Icon */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${theme.iconBg}`}>
                      {isTrigger && <Zap className="w-4 h-4 fill-white" />}
                      {isDelay && <Clock className="w-4 h-4" />}
                      {isWhatsApp && <Send className="w-4 h-4" />}
                      {isCondition && <GitBranch className="w-4 h-4" />}
                      {isTag && <Tag className="w-4 h-4" />}
                      {isExit && <CheckCircle2 className="w-4 h-4" />}
                    </div>

                    {/* Node Text Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className={`text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded ${theme.tagColor}`}>
                          {theme.tag}
                        </span>
                        <Sliders className="w-3 h-3 text-gray-300 group-hover:text-gray-500 transition shrink-0" />
                      </div>

                      <h4 className="font-bold text-gray-900 text-xs truncate leading-snug">
                        {node.label}
                      </h4>
                      <p className="text-[10px] text-gray-400 font-medium truncate mt-0.5">
                        {subtitle}
                      </p>
                    </div>
                  </div>
                </div>
              );
            };

            // Circular Add Step Button
            const renderAddButton = (targetParentId, targetHandle = null) => (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPickerTarget({ parentId: targetParentId, handle: targetHandle });
                  setIsPickerOpen(true);
                }}
                className="w-7 h-7 rounded-full bg-white border-2 border-gray-300 hover:border-[#25D366] hover:bg-emerald-50 text-gray-400 hover:text-[#25D366] flex items-center justify-center shadow-xs transition hover:scale-115 z-10 cursor-pointer"
                title="Add Next Step Here"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            );

            // Recursive Flow Chain Renderer - Clean Vertical Open Tree
            const renderFlowChain = (startNodeId) => {
              const chainNodes = [];
              const visited = new Set();
              let curId = startNodeId;

              while (curId && !visited.has(curId)) {
                visited.add(curId);
                const n = allNodes.find((x) => String(x.id) === String(curId));
                if (!n) break;
                chainNodes.push(n);

                // Stop linear traversal if condition node (forks into branches)
                if (n.type === "condition") {
                  break;
                }

                curId = getEdgeTarget(curId);
              }

              if (chainNodes.length === 0) return null;

              const lastNode = chainNodes[chainNodes.length - 1];
              const isCondition = lastNode.type === "condition";

              return (
                <div className="flex flex-col items-center">
                  {chainNodes.map((node, idx) => {
                    const isLast = idx === chainNodes.length - 1;
                    const isNodeCondition = node.type === "condition";

                    return (
                      <React.Fragment key={node.id}>
                        {/* The Node Card */}
                        {renderNodeCard(node)}

                        {/* Connector down to next linear node */}
                        {!isLast && (
                          <div className="flex flex-col items-center my-1 relative group">
                            <div className="w-0.5 h-5 bg-gray-300 group-hover:bg-[#25D366] transition" />
                            {renderAddButton(node.id, null)}
                            <div className="w-0.5 h-5 bg-gray-300 group-hover:bg-[#25D366] transition" />
                            <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-400 group-hover:border-t-[#25D366] transition" />
                          </div>
                        )}

                        {/* If this node is a Condition, render its Open Tree Fork */}
                        {isNodeCondition && (
                          <div className="w-full flex flex-col items-center mt-1">
                            {/* Stem down from Condition Card */}
                            <div className="w-0.5 h-6 bg-purple-400" />

                            {/* Wide Horizontal Fork Bar */}
                            <div className="w-full max-w-2xl px-6 relative flex items-center justify-between">
                              <div className="absolute top-0 left-12 right-12 h-0.5 bg-purple-300" />
                            </div>

                            {/* Two Open Side-by-Side Tree Branches (No outer container boxes) */}
                            <div className="flex items-start justify-center gap-12 sm:gap-20 pt-1 w-full">
                              {/* ── LEFT BRANCH: YES (Condition Met) ── */}
                              <div className="flex flex-col items-center">
                                {/* Downward connector with floating YES badge */}
                                <div className="w-0.5 h-4 bg-emerald-400" />
                                <div className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold border border-emerald-300 shadow-xs mb-1">
                                  YES
                                </div>
                                <div className="w-0.5 h-4 bg-emerald-400" />
                                <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-emerald-500 mb-2" />

                                {/* Subtree under YES */}
                                {(() => {
                                  const yesTargetId = getEdgeTarget(node.id, "yes");
                                  if (yesTargetId) {
                                    return renderFlowChain(yesTargetId);
                                  }
                                  return (
                                    <div className="flex flex-col items-center">
                                      {renderAddButton(node.id, "yes")}
                                      <span className="text-[10px] font-semibold text-gray-400 mt-1">Add step on YES</span>
                                    </div>
                                  );
                                })()}
                              </div>

                              {/* ── RIGHT BRANCH: NO (Condition Not Met) ── */}
                              <div className="flex flex-col items-center">
                                {/* Downward connector with floating NO badge */}
                                <div className="w-0.5 h-4 bg-amber-400" />
                                <div className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold border border-amber-300 shadow-xs mb-1">
                                  NO
                                </div>
                                <div className="w-0.5 h-4 bg-amber-400" />
                                <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-amber-500 mb-2" />

                                {/* Subtree under NO */}
                                {(() => {
                                  const noTargetId = getEdgeTarget(node.id, "no");
                                  if (noTargetId) {
                                    return renderFlowChain(noTargetId);
                                  }
                                  return (
                                    <div className="flex flex-col items-center">
                                      {renderAddButton(node.id, "no")}
                                      <span className="text-[10px] font-semibold text-gray-400 mt-1">Add step on NO</span>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {/* If chain ends with a regular node, provide a neat circular (+) button to extend */}
                  {!isCondition && (
                    <div className="flex flex-col items-center mt-2">
                      <div className="w-0.5 h-4 bg-gray-300" />
                      {renderAddButton(lastNode.id, null)}
                    </div>
                  )}
                </div>
              );
            };

            // Find root trigger node (or first node) to begin tree rendering
            const rootNode = allNodes.find((n) => n.type === "trigger") || allNodes[0];

            if (!rootNode) {
              return (
                <div className="pt-8 flex flex-col items-center justify-center text-center">
                  <p className="text-sm text-gray-500 mb-3">No steps in this automation yet</p>
                  <button
                    onClick={() => {
                      setPickerTarget(null);
                      setIsPickerOpen(true);
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#25D366] text-white rounded-2xl text-xs font-bold hover:bg-[#1EBE5D] transition shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    Add Trigger Step
                  </button>
                </div>
              );
            }

            return renderFlowChain(rootNode.id);
          })()}
        </div>
      </div>

      {/* ── 🗂️ SLIDE-OUT NODE CONFIGURATION DRAWER (MOCKUP 1) ── */}
      {selectedNode && (
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-white border-l border-gray-200 shadow-2xl z-30 flex flex-col animate-in slide-in-from-right duration-200">
          {/* Drawer Header */}
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Configure {selectedNode.type}
              </span>
              <h3 className="font-bold text-gray-900 text-sm mt-1">
                Node Properties
              </h3>
            </div>
            <button
              onClick={() => setSelectedNodeId(null)}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer Form Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
            {/* Step Label Input */}
            <div className="space-y-1.5">
              <label className="font-bold text-gray-700">Step Label</label>
              <input
                type="text"
                value={selectedNode.label}
                onChange={(e) => updateSelectedNodeLabel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366] outline-none"
              />
            </div>

            {/* Delay Config */}
            {selectedNode.type === "delay" && (() => {
              const currentTotalMinutes = Number(selectedNode.data?.delay_minutes) || 30;
              // Determine best unit if not explicitly stored
              let defaultUnit = "minutes";
              let defaultVal = currentTotalMinutes;
              if (currentTotalMinutes % 1440 === 0 && currentTotalMinutes >= 1440) {
                defaultUnit = "days";
                defaultVal = currentTotalMinutes / 1440;
              } else if (currentTotalMinutes % 60 === 0 && currentTotalMinutes >= 60) {
                defaultUnit = "hours";
                defaultVal = currentTotalMinutes / 60;
              }

              const activeUnit = selectedNode.data?.delay_unit || defaultUnit;
              const activeVal = selectedNode.data?.delay_value !== undefined 
                ? selectedNode.data.delay_value 
                : defaultVal;

              const handleValueOrUnitChange = (val, unit) => {
                const numericVal = Math.max(1, Number(val) || 1);
                let multiplier = 1;
                if (unit === "hours") multiplier = 60;
                if (unit === "days") multiplier = 1440;
                const totalMinutes = numericVal * multiplier;

                // Auto-update node properties
                updateSelectedNode("delay_minutes", totalMinutes);
                updateSelectedNode("delay_unit", unit);
                updateSelectedNode("delay_value", numericVal);

                // Friendly auto-label if user hasn't heavily customized it
                const unitLabel = unit === "days" ? (numericVal === 1 ? "1 Day" : `${numericVal} Days`)
                  : unit === "hours" ? (numericVal === 1 ? "1 Hour" : `${numericVal} Hours`)
                  : `${numericVal} Mins`;
                if (!selectedNode.label || selectedNode.label.startsWith("Wait ")) {
                  updateSelectedNodeLabel(`Wait ${unitLabel}`);
                }
              };

              return (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-gray-700">Wait Duration</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        value={activeVal}
                        onChange={(e) => handleValueOrUnitChange(e.target.value, activeUnit)}
                        className="w-1/2 px-3 py-2 border border-gray-200 rounded-xl font-mono text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none bg-white font-bold text-gray-900"
                      />
                      <select
                        value={activeUnit}
                        onChange={(e) => handleValueOrUnitChange(activeVal, e.target.value)}
                        className="w-1/2 px-3 py-2 border border-gray-200 rounded-xl font-semibold text-sm focus:border-amber-500 outline-none bg-white text-gray-700"
                      >
                        <option value="minutes">Minutes</option>
                        <option value="hours">Hours</option>
                        <option value="days">Days</option>
                      </select>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Total delay: <span className="font-mono font-bold text-amber-900">{currentTotalMinutes.toLocaleString()} minutes</span>
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-gray-700">Quick Presets</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "15 Mins", val: 15, unit: "minutes", dispVal: 15 },
                        { label: "30 Mins", val: 30, unit: "minutes", dispVal: 30 },
                        { label: "1 Hour", val: 60, unit: "hours", dispVal: 1 },
                        { label: "1 Day", val: 1440, unit: "days", dispVal: 1 },
                        { label: "2 Days", val: 2880, unit: "days", dispVal: 2 },
                        { label: "3 Days", val: 4320, unit: "days", dispVal: 3 },
                        { label: "7 Days", val: 10080, unit: "days", dispVal: 7 },
                        { label: "15 Days", val: 21600, unit: "days", dispVal: 15 },
                        { label: "30 Days", val: 43200, unit: "days", dispVal: 30 }
                      ].map((preset) => (
                        <button
                          key={preset.val}
                          onClick={() => handleValueOrUnitChange(preset.dispVal, preset.unit)}
                          className={`py-1.5 px-2 rounded-lg border text-[11px] font-bold transition ${
                            currentTotalMinutes === preset.val
                              ? "bg-amber-50 text-amber-800 border-amber-400 ring-1 ring-amber-400 shadow-xs"
                              : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-white"
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* WhatsApp Message Config */}
            {(selectedNode.type === "whatsapp_message" ||
              selectedNode.type === "action_whatsapp") && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-gray-700">WhatsApp Template</label>
                  <select
                    value={
                      selectedNode.data?.template_name ||
                      availableTemplates[0]?.template_name ||
                      "abandoned_cart_recovery"
                    }
                    onChange={(e) =>
                      updateSelectedNode("template_name", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white focus:border-[#25D366] outline-none font-medium"
                  >
                    {availableTemplates.length > 0 ? (
                      availableTemplates.map((t) => (
                        <option key={t.id || t.template_name} value={t.template_name}>
                          {t.template_name} ({t.language})
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="abandoned_cart_recovery">
                          abandoned_cart_recovery (Marketing)
                        </option>
                        <option value="reengagement_30_days">
                          reengagement_30_days (Winback)
                        </option>
                        <option value="festive_promo_offer">
                          festive_promo_offer (Festivals)
                        </option>
                        <option value="vip_exclusive_offer">
                          vip_exclusive_offer (VIP)
                        </option>
                      </>
                    )}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-gray-700">Discount Coupon Attached</label>
                  <input
                    type="text"
                    value={selectedNode.data?.coupon_code || "BAZIK7"}
                    onChange={(e) =>
                      updateSelectedNode("coupon_code", e.target.value.toUpperCase())
                    }
                    placeholder="e.g. BAZIK7, MANU10"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl font-mono uppercase font-bold text-[#D35400] focus:border-amber-500 outline-none"
                  />
                  <p className="text-[10px] text-gray-400">
                    Auto-injected into the WhatsApp copy code button.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-gray-700">Language</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { code: "en", label: "English" },
                      { code: "gu", label: "Gujarati" },
                      { code: "hi", label: "Hindi" }
                    ].map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => updateSelectedNode("language", lang.code)}
                        className={`py-1.5 rounded-lg border text-xs font-bold transition ${
                          (selectedNode.data?.language || "en") === lang.code
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                            : "bg-gray-50 text-gray-600 border-gray-200"
                        }`}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Inherited Template Mappings Info */}
                {(() => {
                  const selTmpl = availableTemplates.find(t => t.template_name === (selectedNode.data?.template_name || ""));
                  const mappings = selectedNode.data?.variable_mappings || (selTmpl && selTmpl.variable_mappings) || {};
                  const hasMappings = Object.keys(mappings).length > 0;
                  const bodyText = selTmpl?.body_text || "";
                  let preview = bodyText;
                  if (hasMappings && bodyText) {
                    Object.entries(mappings).forEach(([idx, m]) => {
                      const label = m.type === "contact_field" ? (m.value === "name" ? "Customer Name" : m.value)
                        : m.type === "event_field" ? `event.${m.value}`
                        : m.type === "external_api" ? `api.${m.value}`
                        : m.type === "cart_event" ? m.value
                        : m.type === "static" ? ("\"" + m.value + "\"")
                        : (m.value || "?");
                      preview = preview.replace(new RegExp("\\{\\{" + idx + "\\}\\}", "g"), "[" + label + "]");
                    });
                  }
                  return (
                    <div className="space-y-1.5">
                      <label className="font-bold text-gray-700 text-xs">Column Mappings <span className="text-[10px] font-normal text-gray-400">(from template)</span></label>
                      {hasMappings ? (
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(mappings).map(([idx, m]) => {
                            const isApi = m.type === "external_api";
                            const isEvent = m.type === "event_field";
                            const pillStyle = isApi
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : isEvent
                              ? "bg-purple-50 text-purple-800 border-purple-200"
                              : "bg-blue-50 text-blue-700 border-blue-200";

                            const displayVal = m.type === "contact_field" ? m.value
                              : m.type === "static" ? `"${m.value}"`
                              : isEvent ? `event.${m.value}`
                              : isApi ? `api.${m.value}`
                              : `${m.type}.${m.value}`;

                            return (
                              <span key={idx} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${pillStyle}`}>
                                <span className="font-mono">{"{{"}{idx}{"}}"}</span>
                                <span className="opacity-60">→</span>
                                <span>{displayVal}</span>
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                          ⚠ No mappings — configure in Templates tab → 🗂 Columns
                        </p>
                      )}
                      {bodyText && preview !== bodyText && (
                        <div className="bg-[#E7F8EE] border border-[#25D366]/30 rounded-xl p-2.5 text-[10px] text-gray-700">
                          <span className="font-bold text-emerald-800 block mb-1">Live Preview:</span>
                          <p className="italic leading-relaxed">{preview}</p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Condition Config */}
            {selectedNode.type === "condition" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-gray-700">Decision Condition</label>
                  <select
                    value={selectedNode.data?.condition_type || "ORDER_PLACED"}
                    onChange={(e) =>
                      updateSelectedNode("condition_type", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white focus:border-purple-500 outline-none font-medium"
                  >
                    <option value="ORDER_PLACED">Did Customer Purchase / Order?</option>
                    <option value="MESSAGE_READ">Was Message Read (Blue Ticks)?</option>
                    <option value="CART_VALUE_ABOVE">Cart Value is Greater Than ₹X</option>
                  </select>
                </div>

                {selectedNode.data?.condition_type === "CART_VALUE_ABOVE" && (
                  <div className="space-y-1.5">
                    <label className="font-bold text-gray-700">Threshold Amount (₹)</label>
                    <input
                      type="number"
                      value={selectedNode.data?.threshold || 500}
                      onChange={(e) =>
                        updateSelectedNode("threshold", Number(e.target.value))
                      }
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl font-mono text-sm focus:border-purple-500 outline-none"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Tag Config */}
            {selectedNode.type === "tag" && (
              <div className="space-y-1.5">
                <label className="font-bold text-gray-700">Tag to Apply</label>
                <input
                  type="text"
                  value={selectedNode.data?.tag_name || "Recovered Patron"}
                  onChange={(e) =>
                    updateSelectedNode("tag_name", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:border-indigo-500 outline-none font-semibold"
                />
              </div>
            )}

            {/* Exit Outcome Config */}
            {selectedNode.type === "exit" && (
              <div className="space-y-1.5">
                <label className="font-bold text-gray-700">Completion Status</label>
                <select
                  value={selectedNode.data?.outcome || "GOAL_MET"}
                  onChange={(e) => updateSelectedNode("outcome", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white focus:border-emerald-500 outline-none font-medium"
                >
                  <option value="GOAL_MET">Goal Reached (Conversion + Revenue)</option>
                  <option value="DROPOUT">Standard Flow Dropout (Exhausted)</option>
                </select>
              </div>
            )}
          </div>

          {/* Drawer Footer Actions */}
          <div className="p-5 border-t border-gray-100 flex items-center justify-between">
            {selectedNode.type !== "trigger" ? (
              <button
                onClick={() => handleDeleteNode(selectedNode.id)}
                className="flex items-center gap-1 text-red-600 hover:text-red-700 text-xs font-bold transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Node
              </button>
            ) : (
              <span className="text-[10px] text-gray-400 italic">
                Trigger node cannot be deleted
              </span>
            )}

            <button
              onClick={() => setSelectedNodeId(null)}
              className="px-4 py-1.5 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-black transition"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ── ➕ SLIDE-OUT NODE STEP PICKER (MOCKUP 2) ── */}
      {isPickerOpen && (
        <div className="absolute inset-0 bg-black/30 backdrop-blur-xs z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-base">
                  Choose Next Journey Step
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Select an action, delay timer, or decision condition to insert
                </p>
              </div>
              <button
                onClick={() => setIsPickerOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Category Filter Tabs */}
            <div className="px-5 pt-3 flex items-center gap-2 border-b border-gray-100 text-xs">
              {[
                { id: "all", label: "All Steps" },
                { id: "action", label: "Actions" },
                { id: "timing", label: "Timing & Delays" },
                { id: "condition", label: "Conditions" },
                { id: "exit", label: "Goals & Exits" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setPickerFilter(tab.id)}
                  className={`pb-2.5 px-2 font-bold transition border-b-2 ${
                    pickerFilter === tab.id
                      ? "border-[#25D366] text-[#25D366]"
                      : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Step Selection List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {filteredTemplates.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleAddNode(item)}
                    className="p-3.5 border border-gray-200 hover:border-[#25D366] rounded-xl cursor-pointer transition hover:shadow-xs flex items-center justify-between group bg-white hover:bg-emerald-50/20"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${item.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm group-hover:text-[#25D366] transition">
                          {item.title}
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#25D366] group-hover:translate-x-1 transition" />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── 🧪 LIVE FLOW SIMULATOR MODAL ── */}
      {isSimulating && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-xs z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Play className="w-4 h-4 fill-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    Simulate Flow Journey
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    Dry-run or test real WhatsApp dispatch through this journey
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSimulating(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Test Inputs */}
            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-gray-700">
                  Recipient Test Phone Number
                </label>
                <input
                  type="text"
                  value={simPhone}
                  onChange={(e) => setSimPhone(e.target.value)}
                  placeholder="+919876543210"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl font-mono focus:border-blue-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-700">
                  Simulated Cart Value (₹)
                </label>
                <input
                  type="number"
                  value={simCartValue}
                  onChange={(e) => setSimCartValue(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl font-mono focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Simulation Trace Log */}
            {simLog.length > 0 && (
              <div className="space-y-2 text-xs">
                <span className="font-bold text-gray-700">Execution Steps Log:</span>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 max-h-48 overflow-y-auto space-y-2 font-mono text-[11px]">
                  {simLog.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-gray-800">
                      <span className="text-emerald-600 font-bold">✓</span>
                      <div>
                        <span className="font-bold text-gray-900">
                          {step.label || step.node_type}:
                        </span>{" "}
                        <span className="text-gray-600">{step.details}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsSimulating(false)}
                className="px-4 py-2 border border-gray-200 hover:bg-gray-50 rounded-xl text-xs font-semibold text-gray-600 transition"
              >
                Close
              </button>
              <button
                onClick={handleStartSimulation}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                Run Simulation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
