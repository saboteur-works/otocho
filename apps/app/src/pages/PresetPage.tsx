import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Input,
} from "@otocho/ui";
import { newId, type PresetDevice, type PresetPage as PresetPageType, type PresetParam } from "@otocho/core";

const AUTOSAVE_DELAY_MS = 400;

export interface PresetPageProps {
  page: PresetPageType;
  onSave: (page: PresetPageType) => Promise<void>;
}

export function PresetPage({ page, onSave }: PresetPageProps) {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(
    page.devices[0]?.id ?? null,
  );
  const pageIdRef = useRef(page.id);

  // When the page switches, reset selection to first device.
  useEffect(() => {
    if (page.id !== pageIdRef.current) {
      pageIdRef.current = page.id;
      setSelectedDeviceId(page.devices[0]?.id ?? null);
    }
  }, [page.id, page.devices]);

  // Keep selection valid as devices are added/removed.
  useEffect(() => {
    if (selectedDeviceId !== null && !page.devices.find((d) => d.id === selectedDeviceId)) {
      setSelectedDeviceId(page.devices[0]?.id ?? null);
    }
  }, [page.devices, selectedDeviceId]);

  async function addDevice() {
    const device: PresetDevice = { id: newId(), name: "New device", settings: "", params: [] };
    const updated = { ...page, devices: [...page.devices, device] };
    await onSave(updated);
    setSelectedDeviceId(device.id);
  }

  async function updateDevice(deviceId: string, patch: Partial<PresetDevice>) {
    await onSave({
      ...page,
      devices: page.devices.map((d) => (d.id === deviceId ? { ...d, ...patch } : d)),
    });
  }

  async function deleteDevice(deviceId: string) {
    await onSave({ ...page, devices: page.devices.filter((d) => d.id !== deviceId) });
  }

  async function reorderDevices(activeId: string, overId: string) {
    const from = page.devices.findIndex((d) => d.id === activeId);
    const to = page.devices.findIndex((d) => d.id === overId);
    if (from === -1 || to === -1 || from === to) return;
    const reordered = [...page.devices];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    await onSave({ ...page, devices: reordered });
  }

  async function addParam(deviceId: string) {
    const param: PresetParam = { id: newId(), key: "", value: "" };
    await updateDevice(deviceId, {
      params: [...(page.devices.find((d) => d.id === deviceId)?.params ?? []), param],
    });
  }

  async function updateParam(deviceId: string, paramId: string, patch: Partial<PresetParam>) {
    const device = page.devices.find((d) => d.id === deviceId);
    if (!device) return;
    await updateDevice(deviceId, {
      params: device.params.map((p) => (p.id === paramId ? { ...p, ...patch } : p)),
    });
  }

  async function deleteParam(deviceId: string, paramId: string) {
    const device = page.devices.find((d) => d.id === deviceId);
    if (!device) return;
    await updateDevice(deviceId, { params: device.params.filter((p) => p.id !== paramId) });
  }

  const selectedDevice = page.devices.find((d) => d.id === selectedDeviceId) ?? null;

  return (
    <div className="flex h-full flex-col gap-4">
      <h3 className="font-display text-lg font-semibold text-fg-primary">{page.title}</h3>

      <DeviceChain
        devices={page.devices}
        selectedId={selectedDeviceId}
        onSelect={setSelectedDeviceId}
        onAdd={addDevice}
        onReorder={reorderDevices}
      />

      {page.devices.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            onClick={() => void addDevice()}
            className="flex items-center gap-2 text-sm text-fg-tertiary hover:text-fg-primary"
          >
            <Plus className="h-4 w-4" /> Add first device
          </button>
        </div>
      ) : selectedDevice ? (
        <DeviceDetailPanel
          key={selectedDevice.id}
          device={selectedDevice}
          onUpdateName={(name) => updateDevice(selectedDevice.id, { name })}
          onUpdateSettings={(settings) => updateDevice(selectedDevice.id, { settings })}
          onDelete={() => deleteDevice(selectedDevice.id)}
          onAddParam={() => addParam(selectedDevice.id)}
          onUpdateParam={(paramId, patch) => updateParam(selectedDevice.id, paramId, patch)}
          onDeleteParam={(paramId) => deleteParam(selectedDevice.id, paramId)}
        />
      ) : null}
    </div>
  );
}

function DeviceChain({
  devices,
  selectedId,
  onSelect,
  onAdd,
  onReorder,
}: {
  devices: PresetDevice[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onReorder: (activeId: string, overId: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorder(String(active.id), String(over.id));
    }
  }

  if (devices.length === 0) return null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={devices.map((d) => d.id)} strategy={horizontalListSortingStrategy}>
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {devices.map((device, i) => (
            <div key={device.id} className="flex items-center gap-1 shrink-0">
              <SortableDeviceNode
                device={device}
                isSelected={device.id === selectedId}
                onSelect={() => onSelect(device.id)}
              />
              {i < devices.length - 1 && (
                <span className="text-fg-tertiary text-xs select-none">→</span>
              )}
            </div>
          ))}
          <span className="text-fg-tertiary text-xs select-none mx-1">→</span>
          <button
            type="button"
            aria-label="Add device"
            onClick={onAdd}
            className="flex shrink-0 items-center gap-1 rounded-md border border-dashed border-brand-rule px-3 py-1.5 text-xs text-fg-tertiary hover:border-fg-tertiary hover:text-fg-primary"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableDeviceNode({
  device,
  isSelected,
  onSelect,
}: {
  device: PresetDevice;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: device.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : undefined };

  return (
    <div ref={setNodeRef} style={style}>
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={onSelect}
        className={[
          "rounded-md border px-3 py-1.5 text-xs transition-colors cursor-pointer",
          isSelected
            ? "border-fg-primary bg-surface-hover text-fg-primary"
            : "border-brand-rule text-fg-secondary hover:border-fg-tertiary hover:text-fg-primary",
        ].join(" ")}
      >
        {device.name}
      </button>
    </div>
  );
}

function DeviceDetailPanel({
  device,
  onUpdateName,
  onUpdateSettings,
  onDelete,
  onAddParam,
  onUpdateParam,
  onDeleteParam,
}: {
  device: PresetDevice;
  onUpdateName: (name: string) => Promise<void>;
  onUpdateSettings: (settings: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onAddParam: () => Promise<void>;
  onUpdateParam: (paramId: string, patch: Partial<PresetParam>) => Promise<void>;
  onDeleteParam: (paramId: string) => Promise<void>;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(device.name);
  const [settings, setSettings] = useState(device.settings);
  const settingsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (settingsTimerRef.current) clearTimeout(settingsTimerRef.current); }, []);

  function handleSettingsChange(value: string) {
    setSettings(value);
    if (settingsTimerRef.current) clearTimeout(settingsTimerRef.current);
    settingsTimerRef.current = setTimeout(() => void onUpdateSettings(value), AUTOSAVE_DELAY_MS);
  }

  async function submitName(e: FormEvent) {
    e.preventDefault();
    const trimmed = nameDraft.trim();
    if (trimmed.length > 0) await onUpdateName(trimmed);
    setEditingName(false);
  }

  function cancelNameEdit(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") { setNameDraft(device.name); setEditingName(false); }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
      {/* Device name + delete */}
      <div className="flex items-center gap-3">
        {editingName ? (
          <form onSubmit={submitName} className="flex items-center gap-2 flex-1">
            <Input
              aria-label="Device name"
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={cancelNameEdit}
              onBlur={submitName}
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => { setNameDraft(device.name); setEditingName(true); }}
            className="font-display text-base font-semibold text-fg-primary hover:text-fg-secondary text-left"
            aria-label="Edit device name"
          >
            {device.name}
          </button>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="ml-auto text-fg-tertiary hover:text-destructive" aria-label="Delete device">
              <X className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this device?</AlertDialogTitle>
              <AlertDialogDescription>
                "{device.name}" will be permanently removed from the chain.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => void onDelete()}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Settings */}
      <div className="flex flex-col gap-1">
        <span className="font-mono text-xs uppercase tracking-label text-fg-tertiary">Settings</span>
        <textarea
          aria-label="Device settings"
          value={settings}
          onChange={(e) => handleSettingsChange(e.target.value)}
          placeholder="Free-text notes about this device…"
          rows={3}
          className={[
            "resize-none rounded-md bg-otocho-canvas p-3",
            "font-sans text-sm leading-relaxed text-fg-primary placeholder:text-fg-tertiary",
            "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          ].join(" ")}
        />
      </div>

      {/* Parameters */}
      <div className="flex flex-col gap-2">
        <span className="font-mono text-xs uppercase tracking-label text-fg-tertiary">Parameters</span>
        {device.params.length > 0 && (
          <div className="flex flex-col gap-1" role="list" aria-label="Parameters">
            {device.params.map((param) => (
              <ParamRow
                key={param.id}
                param={param}
                onUpdate={(patch) => onUpdateParam(param.id, patch)}
                onDelete={() => onDeleteParam(param.id)}
              />
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => void onAddParam()}
          className="flex items-center gap-1 text-xs text-fg-tertiary hover:text-fg-primary w-fit"
        >
          <Plus className="h-3 w-3" /> add parameter
        </button>
      </div>
    </div>
  );
}

function ParamRow({
  param,
  onUpdate,
  onDelete,
}: {
  param: PresetParam;
  onUpdate: (patch: Partial<PresetParam>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  return (
    <div role="listitem" className="flex items-center gap-2">
      <input
        aria-label="Parameter key"
        value={param.key}
        onChange={(e) => void onUpdate({ key: e.target.value })}
        placeholder="key"
        className={[
          "w-32 rounded bg-otocho-canvas px-2 py-1 font-mono text-xs text-fg-primary placeholder:text-fg-tertiary",
          "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        ].join(" ")}
      />
      <span className="text-fg-tertiary text-xs">=</span>
      <input
        aria-label="Parameter value"
        value={param.value}
        onChange={(e) => void onUpdate({ value: e.target.value })}
        placeholder="value"
        className={[
          "flex-1 rounded bg-otocho-canvas px-2 py-1 font-mono text-xs text-fg-primary placeholder:text-fg-tertiary",
          "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        ].join(" ")}
      />
      <button
        type="button"
        aria-label="Delete parameter"
        onClick={() => void onDelete()}
        className="shrink-0 text-fg-tertiary hover:text-destructive"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
